// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {AdAuction} from "../src/AdAuction.sol";

contract AdAuctionTest is Test {
    AdAuction public adAuction;
    
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public user3 = address(0x3);

    function setUp() public {
        address erc20Token = address(0x123); // テスト用のERC20トークンアドレス
        adAuction = new AdAuction(
            erc20Token,
            "https://example.com/image.png",
            "test-alt",
            "https://example.com"
        );
        vm.deal(user1, 1000 ether);
        vm.deal(user2, 1000 ether);
        vm.deal(user3, 1000 ether);
    }

    function test_InitialAd() public {
        (
            address bidder,
            uint256 bidAmount,
            string memory imageUrl,
            string memory altText,
            string memory hrefUrl,
            uint256 timestamp
        ) = adAuction.getCurrentAd();
        
        assertEq(bidder, address(0));
        assertEq(bidAmount, 0);
        assertEq(keccak256(bytes(imageUrl)), keccak256(bytes("https://example.com/image.png")));
        assertEq(keccak256(bytes(altText)), keccak256(bytes("test-alt")));
        assertEq(keccak256(bytes(hrefUrl)), keccak256(bytes("https://example.com")));
        assertGt(timestamp, 0);
    }

    function test_PlaceBid() public {
        vm.prank(user1);
        adAuction.placeBid{value: 100}(
            "https://example.com/image.png",
            "test-alt",
            "https://example.com"
        );
        
        (
            address bidder,
            uint256 bidAmount,
            string memory imageUrl,
            ,
            ,
        ) = adAuction.getCurrentAd();
        
        assertEq(bidder, user1);
        assertEq(bidAmount, 100);
        assertEq(keccak256(bytes(imageUrl)), keccak256(bytes("https://example.com/image.png")));
    }

    function test_PlaceBidTooLow() public {
        vm.prank(user1);
        adAuction.placeBid{value: 100}(
            "https://example.com/image.png",
            "test-alt",
            "https://example.com"
        );
        
        vm.prank(user2);
        vm.expectRevert("Bid must be at least 100 wei higher than current bid");
        adAuction.placeBid{value: 150}(
            "https://example.com/image2.png",
            "test-alt2",
            "https://example.com/2"
        );
    }

    function test_PlaceBidWithTransfer() public {
        address donationAddress = adAuction.getDonationAddress();
        uint256 donationBalanceBefore = donationAddress.balance;
        
        vm.prank(user1);
        adAuction.placeBid{value: 100}(
            "https://example.com/image.png",
            "test-alt",
            "https://example.com"
        );
        
        // 入札金額がすぐに送金先に送られる
        assertEq(donationAddress.balance, donationBalanceBefore + 100);
        
        // コントラクトの残高は0
        assertEq(adAuction.getBalance(), 0);
        
        vm.prank(user2);
        adAuction.placeBid{value: 250}(
            "https://example.com/image2.png",
            "test-alt2",
            "https://example.com/2"
        );
        
        // 2回目の入札金額も送金先に送られる
        assertEq(donationAddress.balance, donationBalanceBefore + 100 + 250);
        
        // user2の広告が表示される
        (address bidder, , , , ,) = adAuction.getCurrentAd();
        assertEq(bidder, user2);
    }

    function test_GetMinBidAmount() public {
        assertEq(adAuction.getMinBidAmount(), 100);
        
        vm.prank(user1);
        adAuction.placeBid{value: 100}(
            "https://example.com/image.png",
            "test-alt",
            "https://example.com"
        );
        
        assertEq(adAuction.getMinBidAmount(), 200);
    }

    function test_EmptyStrings() public {
        vm.prank(user1);
        vm.expectRevert("Image URL cannot be empty");
        adAuction.placeBid{value: 100}("", "test-alt", "https://example.com");
        
        vm.expectRevert("Alt text cannot be empty");
        adAuction.placeBid{value: 100}("https://example.com/image.png", "", "https://example.com");
        
        vm.expectRevert("Href URL cannot be empty");
        adAuction.placeBid{value: 100}("https://example.com/image.png", "test-alt", "");
    }

    function test_DonationAddress() public {
        address donationAddress = adAuction.getDonationAddress();
        assertEq(donationAddress, 0xE7C3849f94FB6A733E372E991aa12Fee30607119);
    }

    function test_ContractBalanceIsZero() public {
        vm.prank(user1);
        adAuction.placeBid{value: 100}(
            "https://example.com/image.png",
            "test-alt",
            "https://example.com"
        );
        
        // 入札金額はすぐに送金されるため、コントラクトの残高は0
        assertEq(adAuction.getBalance(), 0);
    }
}

