// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {Counter} from "../src/Counter.sol";

contract CounterTest is Test {
    Counter public counter;

    function setUp() public {
        counter = new Counter(0);
    }

    function test_Increment() public {
        uint256 initialCount = counter.count();
        counter.increment();
        assertEq(counter.count(), initialCount + 1);
    }

    function test_Decrement() public {
        counter.increment();
        uint256 initialCount = counter.count();
        counter.decrement();
        assertEq(counter.count(), initialCount - 1);
    }

    function test_DecrementRevertsWhenZero() public {
        vm.expectRevert("Count cannot be negative");
        counter.decrement();
    }

    function test_Reset() public {
        counter.increment();
        counter.increment();
        counter.reset();
        assertEq(counter.count(), 0);
    }

    function test_InitialCount() public {
        Counter newCounter = new Counter(42);
        assertEq(newCounter.count(), 42);
    }
}

