// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title A simple counter contract
/// @notice This contract demonstrates basic functionality
contract Counter {
    uint256 public count;

    event CountUpdated(uint256 newCount);

    constructor(uint256 _initialCount) {
        count = _initialCount;
        emit CountUpdated(_initialCount);
    }

    function increment() public {
        count += 1;
        emit CountUpdated(count);
    }

    function decrement() public {
        require(count > 0, "Count cannot be negative");
        count -= 1;
        emit CountUpdated(count);
    }

    function reset() public {
        count = 0;
        emit CountUpdated(0);
    }
}

