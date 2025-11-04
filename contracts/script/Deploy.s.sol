// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Counter} from "../src/Counter.sol";

contract DeployScript is Script {
    function setUp() public {}

    function run() public returns (Counter) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        uint256 initialCount = vm.envOr("INITIAL_COUNT", uint256(0));
        Counter counter = new Counter(initialCount);

        console.log("Counter deployed at:", address(counter));
        console.log("Initial count:", counter.count());

        vm.stopBroadcast();
        return counter;
    }
}

