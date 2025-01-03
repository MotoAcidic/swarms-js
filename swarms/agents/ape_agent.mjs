// COPYRIGHT 2023 - 2025 The-Swarm-Corporation
// Converted By: MotoAcidic ( TFinch )
import { retry, stopAfterAttempt, waitExponential } from 'tenacity';
import { promptGeneratorSysPrompt as secondSysPrompt } from './prompts/prompt_generator.mjs';
import { promptGeneratorSysPrompt } from './prompts/prompt_generator_optimizer.mjs';
import { initializeLogger } from './utils/loguru_logger.mjs';

const logger = initializeLogger({ logFolder: 'ape_agent' });

/**
 * Retries the function execution up to 3 times, with an exponential backoff.
 */
const autoGeneratePrompt = retry(
    async function (
        task = null,
        model = null,
        maxTokens = 4000,
        useSecondSysPrompt = true,
        ...args
    ) {
        /**
         * Generates a prompt for a given task using the provided model.
         *
         * @param {string|null} task - The task for which to generate a prompt.
         * @param {Object|null} model - The model to be used for prompt generation.
         * @param {number} maxTokens - The maximum number of tokens in the generated prompt. Defaults to 4000.
         * @param {boolean} useSecondSysPrompt - Whether to use the second system prompt. Defaults to true.
         * @param {Array} args - Additional arguments.
         * @returns {Promise<string>} - The generated prompt.
         * @throws {Error} - If prompt generation fails.
         */
        try {
            const systemPrompt = useSecondSysPrompt
                ? secondSysPrompt.getPrompt()
                : promptGeneratorSysPrompt.getPrompt();

            const output = await model.run(systemPrompt + task, {
                maxTokens,
            });
            console.log(output);
            return output;
        } catch (error) {
            logger.error(`Error generating prompt: ${error.message}`);
            throw error;
        }
    },
    {
        stop: stopAfterAttempt(3),
        wait: waitExponential({ multiplier: 1, min: 4, max: 10 }),
    }
);

export { autoGeneratePrompt };
