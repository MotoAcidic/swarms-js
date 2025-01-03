// COPYRIGHT 2023 - 2025 The-Swarm-Corporation
// Converted By: MotoAcidic ( TFinch )
import fs from 'fs';
import path from 'path';
import { setTimeout as sleep } from 'timers/promises';
import { initializeLogger } from './utils/loguru_logger.mjs';
import { captureSystemData, logAgentData } from './telemetry/capture_sys_data.mjs';

const logger = initializeLogger({ logFolder: "onboarding_process" });

export class OnboardingProcess {
    /**
     * Handles the onboarding process for users, collecting user data and system information.
     * @param {string} autoSavePath - Path for automatically saving user data.
     * @param {string} cacheSavePath - Path for caching user data for reliability.
     */
    constructor(autoSavePath = "user_data.json", cacheSavePath = "user_data_cache.json") {
        this.userData = {};
        this.systemData = captureSystemData();
        this.autoSavePath = autoSavePath;
        this.cacheSavePath = cacheSavePath;
        this.loadExistingData();
    }

    /**
     * Loads existing user data from the auto-save file or cache, if available.
     */
    loadExistingData() {
        if (fs.existsSync(this.autoSavePath)) {
            try {
                const data = fs.readFileSync(this.autoSavePath, 'utf-8');
                this.userData = JSON.parse(data);
                logger.info(`Existing user data loaded from ${this.autoSavePath}`);
                return;
            } catch (error) {
                logger.error(`Failed to load user data from main file: ${error.message}`);
            }
        }

        if (fs.existsSync(this.cacheSavePath)) {
            try {
                const data = fs.readFileSync(this.cacheSavePath, 'utf-8');
                this.userData = JSON.parse(data);
                logger.info(`User data loaded from cache: ${this.cacheSavePath}`);
            } catch (error) {
                logger.error(`Failed to load user data from cache: ${error.message}`);
            }
        }
    }

    /**
     * Saves the current user data to both the auto-save file and the cache file.
     * Retries on failure with exponential backoff.
     * @param {number} retryAttempts - Number of retries for saving data.
     */
    async saveData(retryAttempts = 3) {
        let attempt = 0;
        let backoffTime = 1000; // Starting backoff time in milliseconds

        while (attempt < retryAttempts) {
            try {
                const combinedData = { ...this.userData, ...this.systemData };
                logAgentData(combinedData);
                return; // Exit if successful
            } catch (error) {
                logger.error(`Error saving user data (Attempt ${attempt + 1}): ${error.message}`);
            }

            // Retry after a delay with exponential backoff
            await sleep(backoffTime);
            attempt += 1;
            backoffTime *= 2;
        }

        logger.error(`Failed to save user data after ${retryAttempts} attempts.`);
    }

    /**
     * Prompts the user for input and saves it in the userData dictionary.
     * Autosaves and caches data after each valid input.
     * @param {string} prompt - The prompt message for the user.
     * @param {string} key - The key under which the input will be saved.
     */
    async askInput(prompt, key) {
        try {
            const response = await this.promptUser(prompt);
            if (response.trim().toLowerCase() === "quit") {
                logger.info("User chose to quit the onboarding process.");
                process.exit(0);
            }
            if (!response.trim()) throw new Error(`${key} cannot be empty.`);
            this.userData[key] = response.trim();
            await this.saveData();
            return response;
        } catch (error) {
            logger.warn(error.message);
            return this.askInput(prompt, key);
        }
    }

    /**
     * Helper function to simulate input prompt (placeholder for CLI input functionality).
     * @param {string} prompt - The prompt message.
     * @returns {Promise<string>} - The user's input.
     */
    promptUser(prompt) {
        return new Promise((resolve) => {
            process.stdout.write(`${prompt}`);
            process.stdin.once('data', (data) => resolve(data.toString().trim()));
        });
    }

    /**
     * Collects user information during the onboarding process.
     */
    async collectUserInfo() {
        logger.info("Initiating swarms cloud onboarding process...");
        await this.askInput("Enter your first name (or type 'quit' to exit): ", "first_name");
        await this.askInput("Enter your last name (or type 'quit' to exit): ", "last_name");
        await this.askInput("Enter your email (or type 'quit' to exit): ", "email");
        const workspace = await this.askInput(
            "Enter your WORKSPACE_DIR (or type 'quit' to exit). This is where logs, errors, and agent configurations will be stored: ",
            "workspace_dir"
        );
        process.env.WORKSPACE_DIR = workspace;
        logger.info("Please ensure your WORKSPACE_DIR environment variable is set.");
        logger.info("Remember to add your API keys to your .env file.");
        logger.info("Onboarding process completed successfully!");
    }

    /**
     * Runs the onboarding process, handling unexpected errors.
     */
    async run() {
        try {
            await this.collectUserInfo();
        } catch (error) {
            logger.error(`An unexpected error occurred: ${error.message}`);
        } finally {
            logger.info("Finalizing the onboarding process.");
        }
    }
}

// Uncomment to run the onboarding process if this is the main module
// const onboarding = new OnboardingProcess();
// onboarding.run();
