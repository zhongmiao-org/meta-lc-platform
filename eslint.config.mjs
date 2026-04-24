import tsParser from "@typescript-eslint/parser";

const bffSourceFiles = ["packages/bff/src/**/*.ts", "src/**/*.ts"];
const bffTypeFiles = ["packages/bff/src/**/*.type.ts", "src/**/*.type.ts"];
const bffInterfaceFiles = ["packages/bff/src/**/*.interface.ts", "src/**/*.interface.ts"];
const bffDtoFiles = ["packages/bff/src/dto/**/*.ts", "src/dto/**/*.ts"];

const parserConfig = {
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module"
    }
  }
};

export default [
  {
    ignores: ["**/dist/**", "**/node_modules/**"]
  },
  {
    files: bffSourceFiles,
    ...parserConfig
  },
  {
    files: bffInterfaceFiles,
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSTypeAliasDeclaration",
          message: "*.interface.ts files may not declare or export type aliases."
        },
        {
          selector: "ExportNamedDeclaration[exportKind='type'][declaration=null]",
          message: "*.interface.ts files may not export type re-exports."
        },
        {
          selector: "ExportNamedDeclaration > ClassDeclaration",
          message: "*.interface.ts files may only export interface declarations."
        },
        {
          selector: "ExportNamedDeclaration > FunctionDeclaration",
          message: "*.interface.ts files may only export interface declarations."
        },
        {
          selector: "ExportNamedDeclaration > VariableDeclaration",
          message: "*.interface.ts files may only export interface declarations."
        },
        {
          selector: "ExportNamedDeclaration > TSEnumDeclaration",
          message: "*.interface.ts files may only export interface declarations."
        }
      ]
    }
  },
  {
    files: bffTypeFiles,
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSInterfaceDeclaration",
          message: "*.type.ts files may not declare or export interfaces."
        },
        {
          selector: "ExportNamedDeclaration > ClassDeclaration",
          message: "*.type.ts files may only export type declarations."
        },
        {
          selector: "ExportNamedDeclaration > FunctionDeclaration",
          message: "*.type.ts files may only export type declarations."
        },
        {
          selector: "ExportNamedDeclaration > VariableDeclaration",
          message: "*.type.ts files may only export type declarations."
        },
        {
          selector: "ExportNamedDeclaration > TSEnumDeclaration",
          message: "*.type.ts files may only export type declarations."
        }
      ]
    }
  },
  {
    files: bffSourceFiles,
    ignores: bffTypeFiles.concat(bffInterfaceFiles),
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSInterfaceDeclaration",
          message: "TypeScript interfaces must live in a *.interface.ts file."
        },
        {
          selector: "TSTypeAliasDeclaration",
          message: "TypeScript type aliases must live in a *.type.ts file."
        }
      ]
    }
  },
  {
    files: bffDtoFiles,
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSInterfaceDeclaration",
          message: "BFF dto files must be class-only and may not declare interfaces."
        },
        {
          selector: "TSTypeAliasDeclaration",
          message: "BFF dto files must be class-only and may not declare type aliases."
        }
      ]
    }
  }
];
