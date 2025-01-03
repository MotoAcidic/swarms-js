// COPYRIGHT 2023 - 2025 The-Swarm-Corporation
// Converted By: MotoAcidic ( TFinch )
import { config } from 'dotenv';
import { retry, stopAfterAttempt, waitExponential } from 'tenacity';
import { Agent } from './swarms/agent.mjs';
import { createAgentsFromYaml } from './swarms/agents/create_agents_from_yaml.mjs';
import { formatter } from './swarms/utils/formatter.mjs';
import { LiteLLM } from './swarms/utils/litellm_wrapper.mjs';

config();

/**
 * Prepares raw YAML content by fixing spacing and formatting issues.
 * @param {string} rawYaml - The raw YAML content extracted from Markdown.
 * @returns {string} - The cleaned YAML content ready for parsing.
 */
function prepareYamlForParsing(rawYaml) {
    let fixedYaml = rawYaml
        .replace(/(\b\w+\b):\s*-\s*/g, '$1:\n  - ') // Fix "key: - value" to "key:\n  - value"
        .replace(/(\S):(\S)/g, '$1: $2') // Ensure space after colons
        .replace(/\s+\n/g, '\n') // Remove trailing spaces before newlines
        .replace(/\xa0/g, ' '); // Replace non-breaking spaces with regular spaces

    return fixedYaml.trim();
}

/**
 * Extracts and prepares YAML content from a Markdown-style 'Auto-Swarm-Builder' block and parses it.
 * @param {string} markdownText - The Markdown text containing the YAML inside 'Auto-Swarm-Builder' block.
 * @returns {string} - The parsed YAML content.
 * @throws {Error} - If no YAML content is found.
 */
function parseYamlFromSwarmMarkdown(markdownText) {
    const pattern = /```yaml\s*\n(.*?)```/s;
    const match = markdownText.match(pattern);

    if (!match) {
        formatter.printPanel(
            "No YAML content found in the 'Auto-Swarm-Builder' block.",
            "Error"
        );
        throw new Error("No YAML content found in the 'Auto-Swarm-Builder' block.");
    }

    const rawYaml = match[1].trim();
    return prepareYamlForParsing(rawYaml);
}

const AUTO_GEN_PROMPT = `
You are a specialized agent responsible for creating YAML configuration files for multi-agent swarms... (truncated for brevity)
`;

/**
 * Generates a swarm configuration based on the provided task and model name.
 * @param {string} task - The task to be performed by the swarm.
 * @param {string} [fileName="swarm_config_output.yaml"] - The file name for the output YAML configuration.
 * @param {string} [modelName="gpt-4o"] - The name of the model to use for the agent.
 * @param {...any} args - Additional positional arguments.
 * @returns {Promise<any>} - The output of the swarm configuration generation process.
 */
async function generateSwarmConfig(task, fileName = "swarm_config_output.yaml", modelName = "gpt-4o", ...args) {
    formatter.printPanel("Auto Generating Swarm...", "Auto Swarm Builder");

    const attemptGenerateSwarmConfig = retry(async () => {
        try {
            const model = new LiteLLM({ modelName });

            // Initialize the agent
            const agent = new Agent({
                agentName: "Auto-Swarm-Builder",
                systemPrompt: AUTO_GEN_PROMPT,
                llm: model,
                maxLoops: 1,
                dynamicTemperatureEnabled: true,
                savedStatePath: "swarm_builder.json",
                userName: "swarms_corp",
                outputType: "str",
            });

            formatter.printPanel("Agent initialized successfully.", "Info");

            // Generate output from the agent
            const rawOutput = await agent.run(task, ...args);
            formatter.printPanel("Raw output received from the agent.", "Info");

            const yamlContent = parseYamlFromSwarmMarkdown(rawOutput);
            console.log(yamlContent);

            formatter.printPanel("YAML content parsed successfully.", "Info");

            // Create agents from the YAML content
            const output = await createAgentsFromYaml({
                yamlString: yamlContent,
                returnType: "run_swarm",
            });

            formatter.printPanel("Swarm configuration generated successfully.", "Success");

            return output;
        } catch (error) {
            formatter.printPanel(`Error generating swarm configuration: ${error.message}`, "Error");
            throw error;
        }
    }, {
        stop: stopAfterAttempt(3),
        wait: waitExponential({ min: 4, max: 10 }),
    });

    return await attemptGenerateSwarmConfig();
}

export { prepareYamlForParsing, parseYamlFromSwarmMarkdown, generateSwarmConfig };
