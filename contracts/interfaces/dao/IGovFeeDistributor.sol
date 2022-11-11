pragma solidity 0.8.10;

/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * @title InsureDAO governance fee distributor
 * @author InsureDAO
 * @notice This distributes governance fee, which is occured each insurance and saved in the vault,
 *         to veINSURE holders.
 */
interface IGovFeeDistributor {
    /**
     * @notice deposits all govanance fee this contract has,
     *         then receives iToken(Reserve pool's LP token).
     */
    function depositBalanceToReserve() external;

    /**
     * @notice overload function to specify the amount for LP token conversion.
     * @param _amount the amount deposited into reserve pool
     */
    function depositBalanceToReserve(uint256 _amount) external;

    /**
     * @notice claim all eligible amount of iToken to msg sender.
     *         this should be called by a veINSURE holder.
     * @return claimed iToken amount
     */
    function claim() external returns (uint256);

    /**
     * @notice claim all eligible amount of iToken on behalf of holder.
     *         anyone can call this function.
     * @param _to veINSURE holder address all claimed reward send
     * @return claimed iToken amount
     */
    function claim(address _to) external returns (uint256);

    /**
     * @notice execute claim for multiple addresses, this used for multi user distribution,
     *         or claim for same user who has large veINSURE hisrory.
     * @param _receivers the addresses of veINSURE holders.
     * @dev you can include same addresses as params for large veINSURE history.
     * @dev addresses should be left aligned, otherwise claim will be cancelled in the middle of process.
     * @return claim success
     */
    function claimMany(address[20] calldata _receivers) external returns (bool);

    /**
     * @notice checkpoints veINSURE total supply each week.
     *         see VeCheckpointLogic.sol for more details.
     */
    function veSupplyCheckpoint() external;

    /**
     * @notice checkpoints iToken(Reseve pool LP token) total supply each week.
     *         see ITokenCheckpointLogic.sol for more details.
     */
    function iTokenCheckPoint() external;

    /**
     * @notice burn all iToken of msg.sender.
     * @dev technically, token does not go to address(0) but goes to this contract.
     *      so burning increases this contract balance and distributed to holders again.
     * @return burn success
     */
    function burn() external returns (bool);

    /**
     * @notice deactivate the distributor contract. once killed,
     *         the contract permanently unavailable.
     */
    function killMe(address _to) external;

    /**
     * @notice get last checkpointed iToken balance.
     * @return last checkpointed iToken balance.
     */
    function lastITokenBalance() external view returns (uint256);

    /**
     * @notice get last iToken checkpointed time.
     * @return last iToken checkpointed time.
     */
    function lastITokenTime() external view returns (uint256);

    /**
     * @notice get total iToken distribution of a week.
     * @param _weekCursor week boundary distribution activated
     * @dev week cursor must be rounded for the start of a week.
     * @return total iToken distribution of a week.
     */
    function iTokenSupplyAt(uint256 _weekCursor)
        external
        view
        returns (uint256);

    /**
     * @notice get total veINSURE supply of a week.
     * @param _weekCursor week boundary iToken distribution activated
     * @dev week cursor must be rounded for the start of a week.
     * @return total veINSURE supply of a week.
     */
    function veSupplyAt(uint256 _weekCursor) external view returns (uint256);
}
