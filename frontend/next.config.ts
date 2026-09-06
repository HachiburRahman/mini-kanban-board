import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Next 16 writes AGENTS.md / CLAUDE.md into the project on dev start.
  // This repo is a deliverable, so keep those out of the tree.
  agentRules: false,
};

export default nextConfig;
