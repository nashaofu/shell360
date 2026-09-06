import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";

export async function moveArtifacts(
  pattern: string,
  destinationDirectory: string,
): Promise<void> {
  const artifacts = await glob(pattern, { absolute: true, nodir: true });
  if (artifacts.length === 0) {
    throw new Error(`No build artifacts found: ${pattern}`);
  }

  await fs.mkdir(destinationDirectory, { recursive: true });
  for (const artifact of artifacts) {
    const destination = path.join(
      destinationDirectory,
      path.basename(artifact),
    );
    await fs.rm(destination, { force: true });
    await fs.rename(artifact, destination);
    console.log(`[build] Moved artifact to ${destination}`);
  }
}
