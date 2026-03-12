// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IReactiveContract.sol";

/**
 * @title ReactiveBase
 * @notice Base contract for Somnia Reactivity SDK integration.
 *         Inherit this to make a contract reactive — it will automatically
 *         receive callbacks when subscribed on-chain events are emitted.
 *
 * @dev Somnia's reactive runtime calls `react()` on this contract.
 *      Subclasses should override `_onReact()` to handle specific events.
 */
abstract contract ReactiveBase is IReactiveContract {
    /// @notice The Somnia Reactive Network service address (set at deploy time)
    address public immutable reactiveService;

    error OnlyReactiveService();

    modifier onlyReactiveService() {
        if (msg.sender != reactiveService) revert OnlyReactiveService();
        _;
    }

    constructor(address _reactiveService) {
        reactiveService = _reactiveService;
    }

    /// @inheritdoc IReactiveContract
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
    ) external override onlyReactiveService {
        _onReact(chainId, _contract, topic0, topic1, topic2, topic3, data, blockNumber, opCode);
    }

    /**
     * @notice Override this in child contracts to handle reactive callbacks.
     */
    function _onReact(
        uint256 chainId,
        address _contract,
        uint256 topic0,
        uint256 topic1,
        uint256 topic2,
        uint256 topic3,
        bytes calldata data,
        uint256 blockNumber,
        uint256 opCode
    ) internal virtual;
}
