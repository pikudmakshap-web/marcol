function uniqueIds(ids) {
    return [...new Set((ids || []).filter(Boolean))];
}

async function buildUserMapByIds(usersPrisma, ids) {
    const uniqueUserIds = uniqueIds(ids);
    if (uniqueUserIds.length === 0) return new Map();

    const users = await usersPrisma.user.findMany({
        where: { id: { in: uniqueUserIds } },
        select: {
            id: true,
            fullName: true,
            role: true,
            email: true,
            personalNumber: true,
            barcode: true,
            isActive: true,
            hasReadMessage: true
        }
    });

    return new Map(users.map((user) => [user.id, user]));
}

async function getEnvironmentUserIds(usersPrisma, environmentId) {
    const assignments = await usersPrisma.userEnvironment.findMany({
        where: { environmentId },
        select: { userId: true }
    });
    return uniqueIds(assignments.map((assignment) => assignment.userId));
}

module.exports = {
    uniqueIds,
    buildUserMapByIds,
    getEnvironmentUserIds
};
