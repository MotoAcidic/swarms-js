// COPYRIGHT 2023 - 2025 The-Swarm-Corporation
// Converted By: MotoAcidic ( TFinch )
import fs from 'fs';
import yaml from 'yaml';
import { retry, stopAfterAttempt, waitExponential, retryIfExceptionType } from 'tenacity';
import { initializeLogger } from './utils/loguru_logger.mjs';
import { Agent } from './structs/agent.mjs';
import { SwarmRouter } from './structs/swarm_router.mjs';
import { LiteLLM } from './utils/litellm_wrapper.mjs';

const logger = initializeLogger({ logFolder: "create_agents_from_yaml" });

/**
 * Validates and processes the configuration for an agent.
 */
class AgentConfig {
    constructor(config) {
        this.agentName = config.agent_name;
        this.systemPrompt = config.system_prompt;
        this.modelName = config.model_name || null;
        this.maxLoops = config.max_loops || 1;
        this.autosave = config.autosave || true;
        this.dashboard = config.dashboard || false;
        this.verbose = config.verbose || false;
        this.dynamicTemperatureEnabled = config.dynamic_temperature_enabled || false;
        this.savedStatePath = config.saved_state_path || null;
        this.userName = config.user_name || "default_user";
        this.retryAttempts = config.retry_attempts || 3;
        this.contextLength = config.context_length || 100000;
        this.returnStepMeta = config.return_step_meta || false;
        this.outputType = config.output_type || "str";
        this.autoGeneratePrompt = config.auto_generate_prompt || false;
        this.artifactsOn = config.artifacts_on || false;
        this.artifactsFileExtension = config.artifacts_file_extension || ".md";
        this.artifactsOutputPath = config.artifacts_output_path || "";

        if (!this.systemPrompt || typeof this.systemPrompt !== "string" || this.systemPrompt.trim().length === 0) {
            throw new Error("System prompt must be a non-empty string");
        }
    }
}

/**
 * Validates and processes the configuration for a swarm.
 */
class SwarmConfig {
    constructor(config) {
        this.name = config.name;
        this.description = config.description;
        this.maxLoops = config.max_loops || 1;
        this.swarmType = config.swarm_type;
        this.task = config.task || null;
        this.flow = config.flow || null;
        this.autosave = config.autosave || true;
        this.returnJson = config.return_json || false;
        this.rules = config.rules || "";

        const validTypes = new Set([
            "SequentialWorkflow",
            "ConcurrentWorkflow",
            "AgentRearrange",
            "MixtureOfAgents",
            "auto",
        ]);
        if (!validTypes.has(this.swarmType)) {
            throw new Error(`Swarm type must be one of: ${Array.from(validTypes).join(", ")}`);
        }
    }
}

/**
 * Loads and validates a YAML configuration file or string.
 */
function loadYamlSafely({ yamlFile = null, yamlString = null }) {
    try {
        let configDict;
        if (yamlString) {
            configDict = yaml.parse(yamlString);
        } else if (yamlFile) {
            if (!fs.existsSync(yamlFile)) {
                throw new Error(`YAML file ${yamlFile} not found.`);
            }
            const fileContent = fs.readFileSync(yamlFile, "utf-8");
            configDict = yaml.parse(fileContent);
        } else {
            throw new Error("Either yamlFile or yamlString must be provided");
        }

        // Validate using JavaScript equivalent of Pydantic
        if (!configDict.agents || !Array.isArray(configDict.agents) || configDict.agents.length < 1) {
            throw new Error("Invalid YAML: Must contain at least one agent configuration.");
        }
        return configDict;
    } catch (error) {
        throw new Error(`Error validating configuration: ${error.message}`);
    }
}

/**
 * Creates an agent with retry logic to handle transient failures.
 */
const createAgentWithRetry = retry(
    async function (agentConfig, model) {
        try {
            const validatedConfig = new AgentConfig(agentConfig);
            return new Agent({
                agentName: validatedConfig.agentName,
                systemPrompt: validatedConfig.systemPrompt,
                llm: model,
                maxLoops: validatedConfig.maxLoops,
                autosave: validatedConfig.autosave,
                dashboard: validatedConfig.dashboard,
                verbose: validatedConfig.verbose,
                dynamicTemperatureEnabled: validatedConfig.dynamicTemperatureEnabled,
                savedStatePath: validatedConfig.savedStatePath,
                userName: validatedConfig.userName,
                retryAttempts: validatedConfig.retryAttempts,
                contextLength: validatedConfig.contextLength,
                returnStepMeta: validatedConfig.returnStepMeta,
                outputType: validatedConfig.outputType,
                autoGeneratePrompt: validatedConfig.autoGeneratePrompt,
                artifactsOn: validatedConfig.artifactsOn,
                artifactsFileExtension: validatedConfig.artifactsFileExtension,
                artifactsOutputPath: validatedConfig.artifactsOutputPath,
            });
        } catch (error) {
            logger.error(`Error creating agent ${agentConfig.agent_name || "unknown"}: ${error.message}`);
            throw error;
        }
    },
    {
        stop: stopAfterAttempt(3),
        wait: waitExponential({ multiplier: 1, min: 4, max: 10 }),
        retry: retryIfExceptionType([ConnectionError, TimeoutError]),
        beforeRetry: (retryState) => {
            logger.info(`Retrying after error: ${retryState.outcome.exception().message}`);
        },
    }
);

/**
 * Creates agents and/or a SwarmRouter from YAML configurations.
 */
async function createAgentsFromYaml({ model = null, yamlFile = "agents.yaml", yamlString = null, returnType = "auto" }) {
    const agents = [];
    let swarmRouter = null;

    try {
        const config = loadYamlSafely({ yamlFile, yamlString });

        for (const agentConfig of config.agents) {
            logger.info(`Creating agent: ${agentConfig.agent_name}`);
            const modelInstance = new LiteLLM({ modelName: agentConfig.model_name || "gpt-4o" });

            const agent = await createAgentWithRetry(agentConfig, modelInstance);
            logger.info(`Agent ${agentConfig.agent_name} created successfully.`);
            agents.push(agent);
        }

        if (config.swarm_architecture) {
            const swarmConfig = new SwarmConfig(config.swarm_architecture);
            swarmRouter = new SwarmRouter({
                name: swarmConfig.name,
                description: swarmConfig.description,
                maxLoops: swarmConfig.maxLoops,
                agents,
                swarmType: swarmConfig.swarmType,
                task: swarmConfig.task,
                flow: swarmConfig.flow,
                autosave: swarmConfig.autosave,
                returnJson: swarmConfig.returnJson,
                rules: swarmConfig.rules,
            });
            logger.info(`SwarmRouter '${swarmConfig.name}' created successfully.`);
        }

        const validReturnTypes = new Set(["auto", "swarm", "agents", "both", "tasks", "run_swarm"]);
        if (!validReturnTypes.has(returnType)) {
            throw new Error(`Invalid return_type. Must be one of: ${Array.from(validReturnTypes).join(", ")}`);
        }

        switch (returnType) {
            case "run_swarm":
            case "swarm":
                if (!swarmRouter) {
                    throw new Error("Cannot run swarm: SwarmRouter not created.");
                }
                return swarmRouter.run(config.swarm_architecture.task);
            case "agents":
                return agents.length === 1 ? agents[0] : agents;
            case "both":
                return [swarmRouter, agents];
            case "tasks":
                return [];
            default:
                return swarmRouter || (agents.length === 1 ? agents[0] : agents);
        }
    } catch (error) {
        logger.error(`Critical error in createAgentsFromYaml: ${error.message}`);
        throw error;
    }
}

export { loadYamlSafely, createAgentWithRetry, createAgentsFromYaml };
