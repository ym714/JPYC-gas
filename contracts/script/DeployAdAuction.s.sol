// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {AdAuction} from "../src/AdAuction.sol";

contract DeployAdAuctionScript is Script {
    function setUp() public {}

    function run() public returns (AdAuction) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // ERC20トークンアドレスを環境変数から取得（JPYDコントラクトアドレス）
        // デフォルト値としてJPYDのアドレスを設定
        address erc20TokenAddress = vm.envOr(
            "ERC20_TOKEN_ADDRESS",
            address(0x8aC598451c0e06e759C53A80b7e21C0820497871) // JPYDコントラクトアドレス（Polygon Amoy）
        );

        // 初期広告データを環境変数から取得（default.tsの値をデフォルト値として使用）
        string memory initialImageUrl = vm.envOr(
            "INITIAL_IMAGE_URL",
            string("https://jpyc-volunteer.vercel.app/ScreenRecording%202025-11-04%2010.29.44.png")
        );
        string memory initialAltText = vm.envOr(
            "INITIAL_ALT_TEXT",
            string("konaito-copilot")
        );
        string memory initialHrefUrl = vm.envOr(
            "INITIAL_HREF_URL",
            string("https://x.com/konaito_copilot")
        );

        AdAuction adAuction = new AdAuction(
            erc20TokenAddress,
            initialImageUrl,
            initialAltText,
            initialHrefUrl
        );

        console.log("AdAuction deployed at:", address(adAuction));
        console.log("Owner:", adAuction.owner());
        console.log("Min bid increment tokens:", adAuction.MIN_BID_INCREMENT_TOKENS());
        console.log("ERC20 Token Address:", adAuction.getERC20TokenAddress());
        
        (address bidder, uint256 bidAmount, string memory imageUrl, string memory altText, string memory hrefUrl, ) = adAuction.getCurrentAd();
        console.log("Initial Ad - Bidder:", bidder);
        console.log("Initial Ad - Bid Amount:", bidAmount);
        console.log("Initial Ad - Image URL:", imageUrl);
        console.log("Initial Ad - Alt Text:", altText);
        console.log("Initial Ad - Href URL:", hrefUrl);

        vm.stopBroadcast();
        return adAuction;
    }
}

