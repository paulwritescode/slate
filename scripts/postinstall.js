#!/usr/bin/env node
const cyan = "\x1b[36m";
const dim = "\x1b[2m";
const green = "\x1b[32m";
const bold = "\x1b[1m";
const reset = "\x1b[0m";

console.log(`
${cyan}┌──────────────────────────────────────────────────────────┐${reset}
${cyan}│${reset} ${bold}✦ slate${reset} installed successfully                          ${cyan}│${reset}
${cyan}├──────────────────────────────────────────────────────────┤${reset}
${cyan}│${reset}                                                          ${cyan}│${reset}
${cyan}│${reset}  ${green}Quick start:${reset}                                          ${cyan}│${reset}
${cyan}│${reset}    npx cdk synth && npx slate estimate                   ${cyan}│${reset}
${cyan}│${reset}                                                          ${cyan}│${reset}
${cyan}│${reset}  ${green}Detailed cost profile:${reset}                                 ${cyan}│${reset}
${cyan}│${reset}    npx slate wizard                                      ${cyan}│${reset}
${cyan}│${reset}                                                          ${cyan}│${reset}
${cyan}│${reset}  ${dim}Docs: https://example.com${reset}                               ${cyan}│${reset}
${cyan}└──────────────────────────────────────────────────────────┘${reset}
`);
