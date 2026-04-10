// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ProjectRegistry {
    struct Project {
        string[] maintainers;
        uint256 registrationTimestamp;
        bool active;
    }

    mapping(string => Project) public projects;
    // Tracks which addresses are authorized to update each project's maintainer list
    mapping(string => mapping(address => bool)) public isMaintainerAddress;

    event ProjectRegistered(string indexed projectId, string[] maintainers, uint256 timestamp);
    event MaintainersUpdated(string indexed projectId, string[] newMaintainers, bytes signature, uint256 timestamp);

    function registerProject(string memory _projectId, string[] memory _initialMaintainers) public {
        require(!projects[_projectId].active, "ChainVouch: Project already registered");

        projects[_projectId] = Project({
            maintainers: _initialMaintainers,
            registrationTimestamp: block.timestamp,
            active: true
        });

        // The registering address is the first authorized maintainer address
        isMaintainerAddress[_projectId][msg.sender] = true;

        emit ProjectRegistered(_projectId, _initialMaintainers, block.timestamp);
    }

    function updateMaintainers(string memory _projectId, string[] memory _newMaintainers, bytes memory _signature) public {
        require(projects[_projectId].active, "ChainVouch: Project not registered");
        require(isMaintainerAddress[_projectId][msg.sender], "ChainVouch: Caller is not an authorized maintainer");
        projects[_projectId].maintainers = _newMaintainers;
        emit MaintainersUpdated(_projectId, _newMaintainers, _signature, block.timestamp);
    }

    function getMaintainers(string memory _projectId) public view returns (string[] memory) {
        return projects[_projectId].maintainers;
    }
}
