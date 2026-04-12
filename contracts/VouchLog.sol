// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VouchLog {
    // Defines whether this is a vouch or a denouncement
    enum EventType { Vouch, Denounce }

    struct VouchEvent {
        string projectId;
        string contributor;
        string maintainer;
        bytes signature;
        uint256 timestamp;
        EventType eventType;
        string reason;
    }

    // We store the events in an array for basic on-chain reads
    VouchEvent[] public vouchEvents;

    // Indexed parameters allow efficient off-chain querying via eth_getLogs
    event VouchRecorded(
        string indexed projectId,
        string indexed contributor,
        string maintainer,
        bytes signature,
        uint256 timestamp,
        EventType eventType,
        string reason
    );

    /**
     * @dev Records a new vouch or denouncement. 
     * Signatures are passed as bytes and verified off-chain by the CLI/Action.
     */
    function recordVouch(
        string memory _projectId,
        string memory _contributor,
        string memory _maintainer,
        bytes memory _signature,
        EventType _eventType,
        string memory _reason
    ) public {
        require(
            keccak256(bytes(_maintainer)) != keccak256(bytes(_contributor)),
            "ChainVouch: Cannot vouch for yourself"
        );

        VouchEvent memory newEvent = VouchEvent({
            projectId: _projectId,
            contributor: _contributor,
            maintainer: _maintainer,
            signature: _signature,
            timestamp: block.timestamp,
            eventType: _eventType,
            reason: _reason
        });

        vouchEvents.push(newEvent);

        emit VouchRecorded(
            _projectId,
            _contributor,
            _maintainer,
            _signature,
            block.timestamp,
            _eventType,
            _reason
        );
    }
    
    /**
     * @dev Helper to get the total number of events
     */
    function getEventCount() public view returns (uint256) {
        return vouchEvents.length;
    }

    function getVouchesFor(string memory _projectId, string memory _contributor) public view returns (VouchEvent[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < vouchEvents.length; i++) {
            if (vouchEvents[i].eventType == EventType.Vouch &&
                keccak256(bytes(vouchEvents[i].projectId)) == keccak256(bytes(_projectId)) &&
                keccak256(bytes(vouchEvents[i].contributor)) == keccak256(bytes(_contributor))) {
                count++;
            }
        }
        VouchEvent[] memory result = new VouchEvent[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < vouchEvents.length; i++) {
            if (vouchEvents[i].eventType == EventType.Vouch &&
                keccak256(bytes(vouchEvents[i].projectId)) == keccak256(bytes(_projectId)) &&
                keccak256(bytes(vouchEvents[i].contributor)) == keccak256(bytes(_contributor))) {
                result[idx++] = vouchEvents[i];
            }
        }
        return result;
    }

    function getDenouncements(string memory _projectId, string memory _contributor) public view returns (VouchEvent[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < vouchEvents.length; i++) {
            if (vouchEvents[i].eventType == EventType.Denounce &&
                keccak256(bytes(vouchEvents[i].projectId)) == keccak256(bytes(_projectId)) &&
                keccak256(bytes(vouchEvents[i].contributor)) == keccak256(bytes(_contributor))) {
                count++;
            }
        }
        VouchEvent[] memory result = new VouchEvent[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < vouchEvents.length; i++) {
            if (vouchEvents[i].eventType == EventType.Denounce &&
                keccak256(bytes(vouchEvents[i].projectId)) == keccak256(bytes(_projectId)) &&
                keccak256(bytes(vouchEvents[i].contributor)) == keccak256(bytes(_contributor))) {
                result[idx++] = vouchEvents[i];
            }
        }
        return result;
    }
}
