import type { FiberBrowserNode } from '@fiber-pay/sdk/browser';
import { CHANNEL_CAPACITY, FUNDING_FEE_BUFFER, formatCkb } from './amounts';
import { queryBalance } from './testnet-balance';

const required = CHANNEL_CAPACITY + FUNDING_FEE_BUFFER;

export const channelFundingGuidance =
  `Fund this address with at least ${formatCkb(required)}: ${formatCkb(CHANNEL_CAPACITY)} for the channel plus ${formatCkb(FUNDING_FEE_BUFFER)} for the on-chain fee.`;

export async function requireChannelFunding(node: FiberBrowserNode) {
  const { default_funding_lock_script: script } = await node.nodeInfo();
  const capacity = await queryBalance(script);
  if (capacity < required) throw new Error(channelFundingGuidance);
  return capacity;
}
