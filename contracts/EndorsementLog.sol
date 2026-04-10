// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EndorsementLog {
    struct Endorsement {
        string sourceProjectId;   // The project giving the endorsement
        string targetProjectId;   // The project being endorsed
        string maintainer;        // The maintainer who signed it
        bytes signature;          // The SSH/GPG signature
        uint256 timestamp;
    }

    Endorsement[] public endorsements;

    event EndorsementRecorded(
        string indexed sourceProjectId,
        string indexed targetProjectId,
        string maintainer,
        bytes signature,
        uint256 timestamp
    );

    /**
     * @dev Records a project-to-project endorsement.
     * Verification happens off-chain using the maintainer's public key.
     */
    function recordEndorsement(
        string memory _sourceProjectId,
        string memory _targetProjectId,
        string memory _maintainer,
        bytes memory _signature
    ) public {
        Endorsement memory newEndorsement = Endorsement({
            sourceProjectId: _sourceProjectId,
            targetProjectId: _targetProjectId,
            maintainer: _maintainer,
            signature: _signature,
            timestamp: block.timestamp
        });

        endorsements.push(newEndorsement);

        emit EndorsementRecorded(
            _sourceProjectId,
            _targetProjectId,
            _maintainer,
            _signature,
            block.timestamp
        );
    }

    /**
     * @dev Returns total number of endorsements recorded.
     */
    function getEndorsementCount() public view returns (uint256) {
        return endorsements.length;
    }
}
