import nxPlugin from "@nx/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

const bffSourceFiles = ["packages/bff/src/**/*.ts", "src/**/*.ts"];
const bffTypeFiles = ["packages/bff/src/**/*.type.ts", "src/**/*.type.ts"];
const bffInterfaceFiles = ["packages/bff/src/**/*.interface.ts", "src/**/*.interface.ts"];
const bffDtoFiles = ["packages/bff/src/dto/**/*.ts", "src/dto/**/*.ts"];
const workspaceSourceFiles = ["packages/**/*.ts", "apps/**/*.ts"];

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
  ...nxPlugin.configs["flat/base"],
  ...nxPlugin.configs["flat/typescript"],
  {
    ignores: ["**/dist/**", "**/node_modules/**"]
  },
  {
    files: workspaceSourceFiles,
    rules: {
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-case-declarations": "off",
      "@nx/enforce-module-boundaries": [
        "error",
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: "layer:app",
              onlyDependOnLibsWithTags: ["layer:bff"]
            },
            {
              sourceTag: "layer:bff",
              onlyDependOnLibsWithTags: ["layer:runtime", "layer:kernel"]
            },
            {
              sourceTag: "layer:runtime",
              onlyDependOnLibsWithTags: [
                "layer:kernel",
                "layer:query",
                "layer:permission",
                "layer:datasource",
                "layer:audit"
              ]
            },
            {
              sourceTag: "layer:permission",
              onlyDependOnLibsWithTags: ["layer:query"]
            },
            {
              sourceTag: "layer:kernel",
              onlyDependOnLibsWithTags: []
            },
            {
              sourceTag: "layer:query",
              onlyDependOnLibsWithTags: []
            },
            {
              sourceTag: "layer:datasource",
              onlyDependOnLibsWithTags: []
            },
            {
              sourceTag: "layer:audit",
              onlyDependOnLibsWithTags: []
            }
          ]
        }
      ]
    }
  },
  {
    files: ["packages/bff/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@zhongmiao/meta-lc-query",
                "@zhongmiao/meta-lc-permission",
                "@zhongmiao/meta-lc-datasource",
                "@zhongmiao/meta-lc-audit",
                "pg",
                "@types/pg"
              ],
              message:
                "BFF is gateway-only. It must only call runtime/kernel and must not import query, permission, datasource, audit, or pg."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["packages/kernel/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@zhongmiao/meta-lc-runtime",
                "@zhongmiao/meta-lc-query",
                "@zhongmiao/meta-lc-permission",
                "@zhongmiao/meta-lc-datasource",
                "@zhongmiao/meta-lc-audit",
                "@zhongmiao/meta-lc-bff"
              ],
              message:
                "Kernel is the structure source of truth and must not depend on workspace runtime/data/audit packages."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["packages/query/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@zhongmiao/meta-lc-runtime",
                "@zhongmiao/meta-lc-datasource",
                "@zhongmiao/meta-lc-permission",
                "@zhongmiao/meta-lc-bff",
                "@zhongmiao/meta-lc-audit",
                "pg",
                "@types/pg"
              ],
              message:
                "Query only compiles AST/SQL. It must not execute datasource, depend on runtime, or import pg."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["packages/permission/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@zhongmiao/meta-lc-runtime",
                "@zhongmiao/meta-lc-datasource",
                "@zhongmiao/meta-lc-bff",
                "@zhongmiao/meta-lc-audit",
                "pg",
                "@types/pg"
              ],
              message:
                "Permission only transforms Query AST and may depend on query only. It must not execute datasource or depend on runtime/bff."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["packages/datasource/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@zhongmiao/meta-lc-runtime",
                "@zhongmiao/meta-lc-query",
                "@zhongmiao/meta-lc-permission",
                "@zhongmiao/meta-lc-bff",
                "@zhongmiao/meta-lc-audit"
              ],
              message:
                "Datasource is a pure execution adapter and must not depend on runtime/query/permission/bff/audit."
            }
          ]
        }
      ]
    }
  },
  {
    files: ["packages/audit/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@zhongmiao/meta-lc-runtime",
                "@zhongmiao/meta-lc-bff",
                "@zhongmiao/meta-lc-query",
                "@zhongmiao/meta-lc-permission",
                "@zhongmiao/meta-lc-datasource"
              ],
              message:
                "Audit is a passive sink and must not depend on runtime/bff/data packages."
            }
          ]
        }
      ]
    }
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
