// COPYRIGHT 2023 - 2025 The-Swarm-Corporation
// Converted By: MotoAcidic ( TFinch )
import fs from 'fs';
import path from 'path';
import open from 'open';
import { setTimeout as sleep } from 'timers/promises';
import { Command } from 'commander';
import { Console } from 'rich-console';
import { generateSwarmConfig } from './agents/auto_generate_swarm_config.mjs';
import { createAgentsFromYaml } from './agents/create_agents_from_yaml.mjs';
import { OnboardingProcess } from './cli/onboarding_process.mjs';
import { formatter } from './utils/formatter.mjs';

// Initialize console
const console = new Console();

// Custom exception for CLI errors
class SwarmCLIError extends Error {}

// Color scheme
const COLORS = {
    primary: "red",
    secondary: "#FF6B6B",
    accent: "#4A90E2",
    success: "#2ECC71",
    warning: "#F1C40F",
    error: "#E74C3C",
    text: "#FFFFFF",
};

// ASCII art for the CLI
const ASCII_ART = `
   ▄████████  ▄█     █▄     ▄████████    ▄████████   ▄▄▄▄███▄▄▄▄      ▄████████ 
  ███    ███ ███     ███   ███    ███   ███    ███ ▄██▀▀▀███▀▀▀██▄   ███    ███ 
  ███    █▀  ███     ███   ███    ███   ███    ███ ███   ███   ███   ███    █▀  
  ███        ███     ███   ███    ███  ▄███▄▄▄▄██▀ ███   ███   ███   ███        
▀███████████ ███     ███ ▀███████████ ▀▀███▀▀▀▀▀   ███   ███   ███ ▀███████████ 
         ███ ███     ███   ███    ███ ▀███████████ ███   ███   ███          ███ 
   ▄█    ███ ███ ▄█▄ ███   ███    ███   ███    ███ ███   ███   ███    ▄█    ███ 
 ▄████████▀   ▀███▀███▀    ███    █▀    ███    ███  ▀█   ███   █▀   ▄████████▀  
                                        ███    ███                                 
`;

// Display ASCII art
function showAsciiArt() {
    console.print(`
        [${COLORS.primary}]${ASCII_ART}[/${COLORS.primary}]
        Welcome to Swarms CLI!
    `);
}

// Create command table
function createCommandTable() {
    return `
[${COLORS.primary}]Command Reference[/${COLORS.primary}]
[white bold]onboarding[/white bold]   Start the interactive onboarding process
[white bold]help[/white bold]         Display the help menu
[white bold]get-api-key[/white bold]  Retrieve your API key
[white bold]check-login[/white bold]  Verify login and cache initialization
[white bold]run-agents[/white bold]   Execute agents based on YAML config
[white bold]autoswarm[/white bold]    Generate and execute autonomous swarm
`;
}

// Show help message
function showHelp() {
    console.print(createCommandTable());
}

// Show error with optional help text
function showError(message, helpText = null) {
    console.error(`[${COLORS.error}]Error: ${message}[/${COLORS.error}]`);
    if (helpText) console.print(`[${COLORS.warning}]Hint: ${helpText}[/${COLORS.warning}]`);
}

// Execute an action with a spinner
async function executeWithSpinner(action, text) {
    console.print(`[${COLORS.primary}]${text}...[/${COLORS.primary}]`);
    try {
        await action();
    } catch (error) {
        console.error(`[${COLORS.error}]Error during action: ${error.message}[/${COLORS.error}]`);
    }
}

// Get API key with feedback
async function getApiKey() {
    await executeWithSpinner(async () => {
        await open("https://swarms.world/platform/api-keys");
        await sleep(1000);
    }, "Opening API key portal");
    console.print(`[${COLORS.success}]API key portal opened successfully.[/${COLORS.success}]`);
}

// Check login status
async function checkLogin() {
    const cacheFile = path.resolve('cache.txt');
    if (fs.existsSync(cacheFile)) {
        const status = fs.readFileSync(cacheFile, 'utf-8');
        if (status === "logged_in") {
            console.print(`[${COLORS.success}]Authentication verified.[/${COLORS.success}]`);
            return true;
        }
    }

    await executeWithSpinner(async () => {
        fs.writeFileSync(cacheFile, "logged_in");
        await sleep(1000);
    }, "Authenticating login");
    console.print(`[${COLORS.success}]Login successful![/${COLORS.success}]`);
    return true;
}

// Run autoswarm with enhanced error handling
async function runAutoswarm(task, model) {
    if (!task) throw new SwarmCLIError("Task cannot be empty.");
    if (!model) throw new SwarmCLIError("Model name cannot be empty.");

    console.print(`[${COLORS.warning}]Initializing autoswarm...[/${COLORS.warning}]`);
    try {
        const result = await generateSwarmConfig(task, model);
        if (result) {
            console.print(`[${COLORS.success}]Swarm configuration generated successfully![/${COLORS.success}]`);
        } else {
            throw new SwarmCLIError("Failed to generate swarm configuration.");
        }
    } catch (error) {
        showError(error.message, "Check API keys, model name, or task validity.");
    }
}

// Main CLI execution
async function main() {
    const program = new Command();
    program
        .name("swarms-cli")
        .description("Swarms Cloud CLI")
        .option("--yaml-file <path>", "YAML configuration file path", "agents.yaml")
        .option("--task <task>", "Task for autoswarm")
        .option("--model <model>", "Model for autoswarm", "gpt-4");

    program
        .command("onboarding")
        .description("Start interactive onboarding")
        .action(() => OnboardingProcess.run());

    program
        .command("help")
        .description("Display help menu")
        .action(() => showHelp());

    program
        .command("get-api-key")
        .description("Retrieve your API key")
        .action(() => getApiKey());

    program
        .command("check-login")
        .description("Verify login status")
        .action(() => checkLogin());

    program
        .command("run-agents")
        .description("Run agents using YAML configuration")
        .action(({ yamlFile }) => createAgentsFromYaml({ yamlFile, returnType: "tasks" }));

    program
        .command("autoswarm")
        .description("Generate and execute autonomous swarm")
        .action(({ task, model }) => {
            if (!task) {
                showError("Missing required argument: --task", "Usage: swarms-cli autoswarm --task 'Analyze data' --model gpt-4");
                process.exit(1);
            }
            runAutoswarm(task, model);
        });

    program.parse(process.argv);
}

// Run the CLI
main().catch(error => {
    formatter.printPanel(`Error detected: ${error.message}`);
    process.exit(1);
});
