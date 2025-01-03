// COPYRIGHT 2023 - 2025 The-Swarm-Corporation
// Converted By: MotoAcidic ( TFinch )
import { Agent } from './structs/agent.mjs';

/**
 * This function creates an Agent instance and runs a task on it.
 *
 * @param {string} name - The name of the agent.
 * @param {string} systemPrompt - The system prompt for the agent.
 * @param {string} modelName - The name of the model used by the agent.
 * @param {number} maxLoops - The maximum number of loops the agent can run.
 * @param {string} task - The task to be run by the agent.
 * @param {string} img - An image associated with the task (if applicable).
 * @param  {...any} args - Additional arguments.
 * @returns {Promise<any>} - The output of the task run by the agent or null in case of an error.
 */
export async function runAgentByName(name, systemPrompt, modelName, maxLoops, task, img, ...args) {
    try {
        const agent = new Agent({
            agentName: name,
            systemPrompt,
            modelName,
            maxLoops,
        });

        const output = await agent.run({ task, img, ...args });
        return output;
    } catch (error) {
        console.error(`An error occurred: ${error.message}`);
        return null;
    }
}
