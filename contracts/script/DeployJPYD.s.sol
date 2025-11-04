// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {JPYD} from "../src/JPYD.sol";

contract DeployJPYDScript is Script {
    function setUp() public {}

    function run() public returns (JPYD) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // 初期供給量を環境変数から取得（デフォルト: 1,000,000）
        uint256 initialSupply = vm.envOr("INITIAL_SUPPLY", uint256(1000000));

        JPYD jpyd = new JPYD(
            "JPYD Token",
            "JPYD",
            initialSupply
        );

        console.log("JPYD Token deployed at:", address(jpyd));
        console.log("Name:", jpyd.name());
        console.log("Symbol:", jpyd.symbol());
        console.log("Total Supply:", jpyd.totalSupply());
        console.log("Owner:", jpyd.owner());
        console.log("Initial Supply:", initialSupply);

        vm.stopBroadcast();
        return jpyd;
    }
}

