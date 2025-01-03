// COPYRIGHT 2023 - 2025 The-Swarm-Corporation
// Converted By: MotoAcidic ( TFinch )
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import { initializeLogger } from './utils/loguru_logger.mjs';
import { Agent } from './structs/agent.mjs';

const logger = initializeLogger({ logFolder: "openai_assistant" });

/**
 * Check if the OpenAI package is installed, and install it if not.
 * @returns {object} - The OpenAI module.
 * @throws {Error} - If installation fails.
 */
// TODO: Might need to await the import of openAI
function checkOpenAIPackage() {
    try {
        //return await import('openai');
        return import('openai');
    } catch (error) {
        logger.info("OpenAI package not found. Attempting to install...");

        try {
            execSync(`${process.execPath} -m npm install openai`, { stdio: 'inherit' });
            logger.info("OpenAI package installed successfully.");
            //return await import('openai');
            return import('openai');
        } catch (installError) {
            logger.error(`Failed to install OpenAI package: ${installError.message}`);
            throw new Error("OpenAI package installation failed.");
        }
    }
}

export class OpenAIAssistant extends Agent {
    /**
     * OpenAI Assistant wrapper for the swarms framework.
     * @param {object} options - Options for the assistant.
     * @param {string} options.name - Name of the assistant.
     * @param {string} options.description - Description of the assistant.
     * @param {string} [options.instructions] - System instructions for the assistant.
     * @param {string} [options.model="gpt-4o"] - The model to use.
     * @param {Array} [options.tools] - List of tools to enable.
     * @param {Array<string>} [options.fileIds] - List of file IDs to attach.
     * @param {object} [options.metadata] - Additional metadata.
     * @param {Array<object>} [options.functions] - List of custom functions.
     */
    constructor({
        name,
        description = "Standard openai assistant wrapper",
        instructions = null,
        model = "gpt-4o",
        tools = [],
        fileIds = [],
        metadata = {},
        functions = [],
        ...args
    }) {
        super(args);

        this.name = name;
        this.description = description;
        this.instructions = instructions;
        this.model = model;
        this.tools = tools;
        this.fileIds = fileIds;
        this.metadata = metadata;
        this.functions = functions;

        if (functions) {
            this.tools.push(...functions.map(func => ({ type: "function", function: func })));
        }

        const openai = checkOpenAIPackage();
        this.client = new openai.OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        this.assistant = this.client.beta.assistants.create({
            name,
            instructions,
            model,
            tools: this.tools,
            metadata: this.metadata,
        });

        this.availableFunctions = {};
    }

    /**
     * Add a function that the assistant can call.
     */
    addFunction(func, description, parameters) {
        const funcDict = {
            name: func.name,
            description,
            parameters,
        };

        this.tools.push({ type: "function", function: funcDict });
        this.availableFunctions[func.name] = func;

        this.assistant = this.client.beta.assistants.update({
            assistantId: this.assistant.id,
            tools: this.tools,
        });
    }

    async _handleToolCalls(run, threadId) {
        while (run.status === "requires_action") {
            const toolCalls = run.requiredAction.submitToolOutputs.toolCalls;
            const toolOutputs = [];

            for (const toolCall of toolCalls) {
                if (toolCall.type === "function") {
                    const functionName = toolCall.function.name;
                    const functionArgs = JSON.parse(toolCall.function.arguments);

                    if (this.availableFunctions[functionName]) {
                        const functionResponse = this.availableFunctions[functionName](...functionArgs);
                        toolOutputs.push({
                            toolCallId: toolCall.id,
                            output: String(functionResponse),
                        });
                    }
                }
            }

            run = this.client.beta.threads.runs.submitToolOutputs({
                threadId,
                runId: run.id,
                toolOutputs,
            });

            run = await this._waitForRun(run);
        }

        return run;
    }

    async _waitForRun(run) {
        while (true) {
            run = await this.client.beta.threads.runs.retrieve({
                threadId: run.threadId,
                runId: run.id,
            });

            if (run.status === "completed") {
                return run;
            } else if (run.status === "requires_action") {
                run = await this._handleToolCalls(run, run.threadId);
                if (run.status === "completed") return run;
            } else if (["failed", "expired"].includes(run.status)) {
                throw new Error(`Run failed with status: ${run.status}`);
            }

            await sleep(3000); // Wait 3 seconds
        }
    }

    _ensureThread() {
        if (!this.thread) {
            this.thread = this.client.beta.threads.create();
        }
    }

    addMessage(content, fileIds = []) {
        this._ensureThread();
        this.client.beta.threads.messages.create({
            threadId: this.thread.id,
            role: "user",
            content,
            fileIds,
        });
    }

    _getResponse() {
        const messages = this.client.beta.threads.messages.list({
            threadId: this.thread.id,
            order: "desc",
            limit: 1,
        });

        if (!messages.data || messages.data.length === 0) {
            return "";
        }

        const message = messages.data[0];
        return message.role === "assistant" ? message.content[0].text.value : "";
    }

    async run(task, ...args) {
        this._ensureThread();

        this.addMessage(task);

        let run = await this.client.beta.threads.runs.create({
            threadId: this.thread.id,
            assistantId: this.assistant.id,
            instructions: this.instructions,
        });

        run = await this._waitForRun(run);

        return run.status === "completed" ? this._getResponse() : "";
    }

    call(task, ...args) {
        return this.run(task, ...args);
    }
}
