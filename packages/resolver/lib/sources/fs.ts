import path from "path";
import fs from "fs";

import { ResolverSource } from "../source";

export class FS implements ResolverSource {
  workingDirectory: string;
  contractsBuildDirectory: string;

  constructor(workingDirectory: string, contractsBuildDirectory: string) {
    this.workingDirectory = workingDirectory;
    this.contractsBuildDirectory = contractsBuildDirectory;
  }

  require(importPath: string, searchPath = this.contractsBuildDirectory) {
    const normalizedImportPath = path.normalize(importPath);
    const contractName = this.getContractName(normalizedImportPath, searchPath);

    // If we have an absolute path, only check the file if it's a child of the workingDirectory.
    if (path.isAbsolute(normalizedImportPath)) {
      if (normalizedImportPath.indexOf(this.workingDirectory) !== 0) {
        return null;
      }
    }

    try {
      const result = fs.readFileSync(
        path.join(searchPath, `${contractName}.json`),
        "utf8"
      );
      return JSON.parse(result);
    } catch (e) {
      return null;
    }
  }

  getContractName(
    sourcePath: string,
    searchPath = this.contractsBuildDirectory
  ) {
    const contractsBuildDirFiles = fs.readdirSync(searchPath);
    const filteredBuildArtifacts = contractsBuildDirFiles.filter(
      (file: string) => file.match(".json") != null
    );

    for (const buildArtifact of filteredBuildArtifacts) {
      const artifact = JSON.parse(
        fs.readFileSync(path.resolve(searchPath, buildArtifact)).toString()
      );

      if (artifact.sourcePath === sourcePath) {
        return artifact.contractName;
      }
    }

    // fallback
    return path.basename(sourcePath, ".sol");
  }

  async resolve(importPath: string, importedFrom: string) {
    importedFrom = importedFrom || "";
    const possiblePaths = [
      importPath,
      path.join(path.dirname(importedFrom), importPath)
    ];

    let body, filePath;

    if (importPath === "truffle/Console.sol") {
      const actualImportPath =
        // @ts-ignore
        typeof BUNDLE_VERSION !== "undefined"
          ? path.resolve(__dirname, path.basename(importPath))
          : path.resolve(
              __dirname,
              "../../core/lib/logging",
              path.basename(importPath)
            );
      const resolvedSource = fs.readFileSync(actualImportPath, {
        encoding: "utf8"
      });
      body = resolvedSource;
      filePath = importPath;

      return { body, filePath };
    }

    for (const possiblePath of possiblePaths) {
      try {
        const resolvedSource = fs.readFileSync(possiblePath, {
          encoding: "utf8"
        });
        body = resolvedSource;
        filePath = possiblePath;

        return { body, filePath };
      } catch (error) {
        // do nothing
      }
    }

    return { body, filePath };
  }

  // Here we're resolving from local files to local files, all absolute.
  resolveDependencyPath(importPath: string, dependencyPath: string) {
    const dirname = path.dirname(importPath);
    return path.resolve(path.join(dirname, dependencyPath));
  }
}
