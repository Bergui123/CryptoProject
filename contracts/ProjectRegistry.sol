// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ProjectRegistry {
    struct Project {
        string[] maintainers;
        uint256 registrationTimestamp;
        bool active;
    }

    mapping(string => Project) public projects;

    event ProjectRegistered(string indexed projectId, string[] maintainers, uint256 timestamp);
    event MaintainersUpdated(string indexed projectId, string[] newMaintainers, bytes signature, uint256 timestamp);

    function registerProject(string memory _projectId, string[] memory _initialMaintainers) public {
        require(!projects[_projectId].active, "ChainVouch: Project already registered");

        projects[_projectId] = Project({
            maintainers: _initialMaintainers,
            registrationTimestamp: block.timestamp,
            active: true
        });

        emit ProjectRegistered(_projectId, _initialMaintainers, block.timestamp);
    }

    function updateMaintainers(string memory _projectId, string[] memory _newMaintainers, bytes memory _signature) public {
        require(projects[_projectId].active, "ChainVouch: Project not registered");
        projects[_projectId].maintainers = _newMaintainers;
        emit MaintainersUpdated(_projectId, _newMaintainers, _signature, block.timestamp);
    }
    
    function getMaintainers(string memory _projectId) public view returns (string[] memory) {
        return projects[_projectId].maintainers;
    }
}
