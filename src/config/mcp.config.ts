/**
 * Model Context Protocol (MCP) server configurations
 *
 * Required MCP Servers:
 * 1. GitHub - For PR/repo operations
 * 2. ESLint - For code linting and style analysis
 *
 * Documentation:
 * - MCP Protocol: https://modelcontextprotocol.io
 * - GitHub MCP: https://github.com/github/github-mcp-server
 * - ESLint MCP: https://eslint.org/docs/latest/use/mcp
 */
//import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ override: true });

export interface McpServerConfig {
  type: "stdio";
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export const mcpServersConfig: Record<string, McpServerConfig> = {
  github: {
    type: "stdio",
    command: "npx", // TODO: What command runs the ESLint MCP server?
    args: ["-y", "@modelcontextprotocol/server-github"], // TODO: What arguments install and run @eslint/mcp@latest?
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || '' },        
  },
  eslint: {
    type: "stdio",
    command: "npx", // TODO: What command runs the ESLint MCP server?
    args: ["-y", "@eslint/mcp@latest"], // TODO: What arguments install and run @eslint/mcp@latest?
    env: {},    
  }
};
