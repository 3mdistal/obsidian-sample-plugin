import { App, Plugin, Modal, Notice, TFile } from "obsidian";

class QueryModal extends Modal {
	onSubmit: (result: string) => void;
	inputEl: HTMLTextAreaElement;

	constructor(app: App, onSubmit: (result: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText("Enter Dataview Query:");
		this.inputEl = contentEl.createEl("textarea");
		this.inputEl.style.width = "100%";
		this.inputEl.style.height = "100px";
		this.inputEl.value = "LIST FROM"; // Default query

		const submitBtn = contentEl.createEl("button", { text: "Submit" });
		submitBtn.style.marginTop = "10px";
		submitBtn.onclick = () => {
			this.close();
			this.onSubmit(this.inputEl.value);
		};
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export default class AIDigestPlugin extends Plugin {
	async onload() {
		this.addRibbonIcon("brain", "Generate AI Digest", async () => {
			const query = await new Promise<string>((resolve) => {
				new QueryModal(this.app, resolve).open();
			});

			// @ts-ignore
			const dataviewApi = this.app.plugins.plugins.dataview?.api;
			if (!dataviewApi) {
				new Notice("Dataview plugin is not available");
				return;
			}

			try {
				const queryResult = await dataviewApi.query(query);
				console.log("Raw query result:", queryResult); // Log the raw query result
				if (queryResult.successful) {
					await this.saveFile(queryResult);
				} else {
					console.error(
						"Dataview query was not successful:",
						queryResult.error
					);
					new Notice(`Dataview query failed: ${queryResult.error}`);
				}
			} catch (error) {
				console.error("Error executing query:", error);
				new Notice(
					"Error executing Dataview query. Check console for details."
				);
			}
		});
	}

	async saveFile(queryResult: any) {
		console.log("Query result:", JSON.stringify(queryResult, null, 2));

		const fileContents: string[] = [];

		try {
			if (
				queryResult &&
				queryResult.value &&
				queryResult.value.values &&
				Array.isArray(queryResult.value.values)
			) {
				for (const item of queryResult.value.values) {
					if (item.path && typeof item.path === "string") {
						const file = this.app.vault.getAbstractFileByPath(
							item.path
						);
						if (file instanceof TFile) {
							const content = await this.app.vault.read(file);
							const fileName = file.basename;
							fileContents.push(
								`# ${fileName}\n\nPath: ${item.path}\n\n${content}\n\n---\n---\n`
							);
						}
					}
				}
			} else {
				console.error(
					"Unexpected query result structure:",
					queryResult
				);
				new Notice(
					"Unexpected query result structure. Check console for details."
				);
				return;
			}

			if (fileContents.length === 0) {
				console.warn("No file contents found in query result");
				new Notice("No file contents found in query result");
				return;
			}

			const content = fileContents.join("\n");

			const fileName = "ai-digest.md";
			let file = this.app.vault.getAbstractFileByPath(fileName);

			if (file instanceof TFile) {
				await this.app.vault.modify(file, content);
				console.log(`File updated: ${file.path}`);
			} else {
				file = await this.app.vault.create(fileName, content);
				console.log(`New file created: ${fileName}`);
			}

			new Notice(`AI Digest saved successfully to ${fileName}`);
		} catch (error) {
			console.error(
				"Error processing query result or saving file:",
				error
			);
			new Notice("Error saving AI Digest. Check console for details.");
		}
	}
}
