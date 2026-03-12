// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IReactiveContract
 * @notice Interface for Somnia Reactivity SDK reactive contracts.
 *         Reactive contracts subscribe to on-chain events and execute
 *         callbacks atomically when those events are emitted.
 *
 * @dev See Somnia Reactivity SDK documentation for full integration guide.
 *      RPC: https://dream-rpc.somnia.network | Chain ID: 50312
 */
interface IReactiveContract {
    /**
     * @notice Called by the Somnia Reactivity runtime when a subscribed
     *         event is detected on-chain.
     * @param chainId   The chain ID where the event originated
     * @param _contract The contract address that emitted the event
     * @param topic0    Event signature hash (keccak256)
     * @param topic1    First indexed event parameter
     * @param topic2    Second indexed event parameter
     * @param topic3    Third indexed event parameter
     * @param data      ABI-encoded non-indexed event data
     * @param blockNumber Block number of the emitting transaction
     * @param opCode    Reactivity opcode for routing
     */
    function react(
        uint256 chainId,
        address _contract,
        uint256 topic0,
        uint256 topic1,
        uint256 topic2,
        uint256 topic3,
        bytes calldata data,
        uint256 blockNumber,
        uint256 opCode
    ) external;
}
