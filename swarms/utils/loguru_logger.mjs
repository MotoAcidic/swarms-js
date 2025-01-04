import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { logger } from 'loguru';
import fs from 'fs';
import path from 'path';

function initializeLogger(logFolder = 'logs') {
    const AGENT_WORKSPACE = 'agent_workspace';

    // Check if WORKSPACE_DIR is set, if not, set it to AGENT_WORKSPACE
    if (!process.env.WORKSPACE_DIR) {
        process.env.WORKSPACE_DIR = AGENT_WORKSPACE;
    }

    // Create a folder within the agent_workspace
    const logFolderPath = path.join(process.env.WORKSPACE_DIR, logFolder);
    if (!fs.existsSync(logFolderPath)) {
        fs.mkdirSync(logFolderPath, { recursive: true });
    }

    // Generate a unique identifier for the log file
    const uuidForLog = uuidv4();
    const logFilePath = path.join(logFolderPath, `${logFolder}_${uuidForLog}.log`);

    logger.add(logFilePath, {
        level: 'info',
        colorize: true,
        backtrace: true,
        diagnose: true,
        enqueue: true,
        retention: '10 days',
        // compression: 'zip',
    });

    return logger;
}

// Example usage:
// const logger = initializeLogger();
// logger.info('Logger initialized');