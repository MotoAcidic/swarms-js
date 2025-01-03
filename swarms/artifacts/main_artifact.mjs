// COPYRIGHT 2023 - 2025 The-Swarm-Corporation
// Converted By: MotoAcidic ( TFinch )
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { format } from 'date-fns';
import { initializeLogger } from './utils/loguru_logger.mjs';
import { createFileInFolder } from './utils/file_processing.mjs';

const logger = initializeLogger({ logFolder: "main_artifact" });

export class FileVersion {
    /**
     * Represents a version of the file with its content and timestamp.
     * @param {number} versionNumber - The version number of the file.
     * @param {string} content - The content of the file version.
     * @param {string} timestamp - The timestamp of the file version.
     */
    constructor(versionNumber, content, timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss')) {
        this.versionNumber = versionNumber;
        this.content = content;
        this.timestamp = timestamp;
    }

    toString() {
        return `Version ${this.versionNumber} (Timestamp: ${this.timestamp}):\n${this.content}`;
    }
}

export class Artifact {
    /**
     * Represents a file artifact.
     * @param {string} filePath - The path to the file.
     * @param {string} fileType - The type of the file.
     * @param {string} contents - The contents of the file.
     * @param {string} folderPath - The path to the folder containing the file.
     * @param {number} editCount - The number of times the file has been edited.
     */
    constructor({
        filePath,
        fileType,
        contents,
        folderPath = process.env.WORKSPACE_DIR || '',
        editCount = 0,
        versions = [],
    }) {
        this.filePath = filePath;
        this.fileType = this.validateFileType(fileType, filePath);
        this.contents = contents;
        this.folderPath = folderPath;
        this.editCount = editCount;
        this.versions = versions;
    }

    validateFileType(fileType, filePath) {
        if (!fileType) {
            const ext = path.extname(filePath).toLowerCase();
            const supportedTypes = [
                ".py", ".csv", ".tsv", ".txt", ".json", ".xml", ".html", ".yaml", ".yml", ".md",
                ".rst", ".log", ".sh", ".bat", ".ps1", ".ini", ".hcl", ".tf", ".properties"
            ];
            if (!supportedTypes.includes(ext)) {
                throw new Error("Unsupported file type");
            }
            return ext;
        }
        return fileType;
    }

    create(initialContent) {
        try {
            this.contents = initialContent;
            this.versions.push(new FileVersion(1, initialContent));
            this.editCount = 0;
        } catch (error) {
            logger.error(`Error creating artifact: ${error.message}`);
            throw error;
        }
    }

    edit(newContent) {
        try {
            this.contents = newContent;
            this.editCount += 1;
            const newVersion = new FileVersion(this.versions.length + 1, newContent);
            this.versions.push(newVersion);
        } catch (error) {
            logger.error(`Error editing artifact: ${error.message}`);
            throw error;
        }
    }

    save() {
        fs.writeFileSync(this.filePath, this.contents, 'utf-8');
    }

    load() {
        this.contents = fs.readFileSync(this.filePath, 'utf-8');
        this.create(this.contents);
    }

    getVersion(versionNumber) {
        return this.versions.find(v => v.versionNumber === versionNumber) || null;
    }

    getContents() {
        return this.contents;
    }

    getVersionHistory() {
        return this.versions.map(v => v.toString()).join('\n\n');
    }

    exportToJson(filePath) {
        fs.writeFileSync(filePath, JSON.stringify(this, null, 4), 'utf-8');
    }

    static importFromJson(filePath) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        data.versions = data.versions.map(v => new FileVersion(v.versionNumber, v.content, v.timestamp));
        return new Artifact(data);
    }

    getMetrics() {
        return `
            File Path: ${this.filePath}
            File Type: ${this.fileType}
            Current Contents:
            ${this.contents}
            Edit Count: ${this.editCount}
            Version History:
            ${this.getVersionHistory()}
        `;
    }

    saveAs(outputFormat) {
        const supportedFormats = [".md", ".txt", ".pdf", ".py"];
        if (!supportedFormats.includes(outputFormat)) {
            throw new Error(`Unsupported output format. Supported formats are: ${supportedFormats.join(", ")}`);
        }

        const outputPath = `${path.basename(this.filePath, path.extname(this.filePath))}${outputFormat}`;

        if (outputFormat === ".pdf") {
            this._saveAsPdf(outputPath);
        } else {
            createFileInFolder(this.folderPath, outputPath, this.contents);
        }
    }
// TODO: Turn this into async function
    _saveAsPdf(outputPath) {
        try {
            //const { Canvas, letter } = await import('pdfkit');
            const { Canvas, letter } = import('pdfkit');
            const doc = new Canvas({ size: letter });
            doc.pipe(fs.createWriteStream(outputPath));

            let y = 750;
            this.contents.split('\n').forEach(line => {
                doc.text(line, 50, y);
                y -= 15;
                if (y < 50) {
                    doc.addPage();
                    y = 750;
                }
            });

            doc.end();
        } catch (error) {
            logger.error(`Error creating PDF: ${error.message}`);
            execSync('npm install pdfkit', { stdio: 'inherit' });
            this._saveAsPdf(outputPath);
        }
    }
}
