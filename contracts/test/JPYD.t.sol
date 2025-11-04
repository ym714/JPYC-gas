// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {JPYD} from "../src/JPYD.sol";

contract JPYDTest is Test {
    JPYD public jpyd;
    
    address public owner = address(0x1);
    address public user1 = address(0x2);
    address public user2 = address(0x3);

    function setUp() public {
        vm.prank(owner);
        jpyd = new JPYD("JPYD Token", "JPYD", 1000000); // 1,000,000 tokens
    }

    function test_InitialState() public {
        assertEq(jpyd.name(), "JPYD Token");
        assertEq(jpyd.symbol(), "JPYD");
        assertEq(jpyd.decimals(), 18);
        assertEq(jpyd.totalSupply(), 1000000 * 10**18);
        assertEq(jpyd.balanceOf(owner), 1000000 * 10**18);
        assertEq(jpyd.owner(), owner);
    }

    function test_Transfer() public {
        vm.prank(owner);
        bool success = jpyd.transfer(user1, 1000 * 10**18);
        assertTrue(success);
        assertEq(jpyd.balanceOf(user1), 1000 * 10**18);
        assertEq(jpyd.balanceOf(owner), (1000000 - 1000) * 10**18);
    }

    function test_TransferInsufficientBalance() public {
        vm.prank(user1);
        vm.expectRevert("JPYD: insufficient balance");
        jpyd.transfer(user2, 1000 * 10**18);
    }

    function test_TransferToZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("JPYD: transfer to the zero address");
        jpyd.transfer(address(0), 1000 * 10**18);
    }

    function test_Approve() public {
        vm.prank(owner);
        bool success = jpyd.approve(user1, 1000 * 10**18);
        assertTrue(success);
        assertEq(jpyd.allowance(owner, user1), 1000 * 10**18);
    }

    function test_TransferFrom() public {
        vm.prank(owner);
        jpyd.approve(user1, 1000 * 10**18);

        vm.prank(user1);
        bool success = jpyd.transferFrom(owner, user2, 500 * 10**18);
        assertTrue(success);
        assertEq(jpyd.balanceOf(user2), 500 * 10**18);
        assertEq(jpyd.allowance(owner, user1), 500 * 10**18);
    }

    function test_TransferFromInsufficientAllowance() public {
        vm.prank(owner);
        jpyd.approve(user1, 1000 * 10**18);

        vm.prank(user1);
        vm.expectRevert("JPYD: insufficient allowance");
        jpyd.transferFrom(owner, user2, 2000 * 10**18);
    }

    function test_Mint() public {
        vm.prank(owner);
        jpyd.mint(user1, 5000 * 10**18);
        
        assertEq(jpyd.balanceOf(user1), 5000 * 10**18);
        assertEq(jpyd.totalSupply(), (1000000 + 5000) * 10**18);
    }

    function test_MintNotOwner() public {
        vm.prank(user1);
        vm.expectRevert("JPYD: caller is not the owner");
        jpyd.mint(user2, 1000 * 10**18);
    }

    function test_Burn() public {
        vm.prank(owner);
        jpyd.burn(1000 * 10**18);
        
        assertEq(jpyd.balanceOf(owner), (1000000 - 1000) * 10**18);
        assertEq(jpyd.totalSupply(), (1000000 - 1000) * 10**18);
    }

    function test_BurnInsufficientBalance() public {
        vm.prank(user1);
        vm.expectRevert("JPYD: insufficient balance");
        jpyd.burn(1000 * 10**18);
    }

    function test_TransferOwnership() public {
        vm.prank(owner);
        jpyd.transferOwnership(user1);
        
        assertEq(jpyd.owner(), user1);
    }

    function test_TransferOwnershipNotOwner() public {
        vm.prank(user1);
        vm.expectRevert("JPYD: caller is not the owner");
        jpyd.transferOwnership(user2);
    }

    function test_TransferOwnershipToZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("JPYD: new owner is the zero address");
        jpyd.transferOwnership(address(0));
    }
}

