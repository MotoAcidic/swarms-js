// COPYRIGHT 2023 - 2025 The-Swarm-Corporation
// Converted By: MotoAcidic ( TFinch )
import { Jsonformer } from './tools/json_former.mjs';
import { initializeLogger } from './utils/loguru_logger.mjs';
import { lazyImportDecorator } from './utils/lazy_loader.mjs';

const logger = initializeLogger({ logFolder: "tool_agent" });

/**
 * Represents a tool agent that performs a specific task using a model and tokenizer.
 */
export class ToolAgent {
    /**
     * Initializes the ToolAgent instance.
     * @param {Object} options - The options for the ToolAgent.
     * @param {string} [options.name="Function Calling Agent"] - The name of the tool agent.
     * @param {string} [options.description="Generates a function based on the input JSON schema and the task"] - A description of the tool agent.
     * @param {Object} [options.model=null] - The model used by the tool agent.
     * @param {Object} [options.tokenizer=null] - The tokenizer used by the tool agent.
     * @param {Object} [options.jsonSchema=null] - The JSON schema used by the tool agent.
     * @param {number} [options.maxNumberTokens=500] - The maximum number of tokens to generate.
     * @param {Function} [options.parsingFunction=null] - A custom function to parse the output.
     * @param {Object} [options.llm=null] - An LLM object for the tool agent.
     * @param {Array} args - Additional arguments.
     * @param {Object} kwargs - Additional keyword arguments.
     */
    constructor({
        name = "Function Calling Agent",
        description = "Generates a function based on the input JSON schema and the task",
        model = null,
        tokenizer = null,
        jsonSchema = null,
        maxNumberTokens = 500,
        parsingFunction = null,
        llm = null,
        ...kwargs
    } = {}) {
        super({ agentName: name, agentDescription: description, llm, ...kwargs });
        this.name = name;
        this.description = description;
        this.model = model;
        this.tokenizer = tokenizer;
        this.jsonSchema = jsonSchema;
        this.maxNumberTokens = maxNumberTokens;
        this.parsingFunction = parsingFunction;
        this.llm = llm;
    }

    /**
     * Runs the tool agent for the specified task.
     * @param {string} task - The task to be performed by the tool agent.
     * @param {Array} args - Additional arguments.
     * @param {Object} kwargs - Additional keyword arguments.
     * @returns {any} - The output of the tool agent.
     * @throws {Error} - If an error occurs during the execution of the tool agent.
     */
    async run(task, ...args) {
        try {
            if (this.model) {
                logger.info(`Running ${this.name} for task: ${task}`);
                this.toolAgent = new Jsonformer({
                    model: this.model,
                    tokenizer: this.tokenizer,
                    jsonSchema: this.jsonSchema,
                    llm: this.llm,
                    prompt: task,
                    maxNumberTokens: this.maxNumberTokens,
                    ...args,
                });

                return this.parsingFunction
                    ? this.parsingFunction(await this.toolAgent())
                    : await this.toolAgent();
            } else if (this.llm) {
                logger.info(`Running ${this.name} for task: ${task}`);
                this.toolAgent = new Jsonformer({
                    jsonSchema: this.jsonSchema,
                    llm: this.llm,
                    prompt: task,
                    maxNumberTokens: this.maxNumberTokens,
                    ...args,
                });

                return this.parsingFunction
                    ? this.parsingFunction(await this.toolAgent())
                    : await this.toolAgent();
            } else {
                throw new Error("Either model or llm should be provided to the ToolAgent.");
            }
        } catch (error) {
            logger.error(`Error running ${this.name} for task: ${task}`);
            throw error;
        }
    }

    /**
     * Enables the ToolAgent instance to be called like a function.
     * @param {string} task - The task to be performed by the tool agent.
     * @param {Array} args - Additional arguments.
     * @param {Object} kwargs - Additional keyword arguments.
     * @returns {any} - The output of the tool agent.
     */
    async call(task, ...args) {
        return this.run(task, ...args);
    }
}
