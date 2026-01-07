const BADGE_LEVELS = [
    { threshold: 100, name: "Kind Starter", icon: "seed-outline", category: "Milestone" },
    { threshold: 250, name: "Bronze Donor", icon: "shield-outline", category: "Milestone" },
    { threshold: 500, name: "Silver Giver", icon: "shield", category: "Milestone" },
    { threshold: 750, name: "Gold Provider", icon: "trophy-outline", category: "Milestone" },
    { threshold: 1000, name: "Platinum Helper", icon: "trophy", category: "Milestone" },
    { threshold: 1500, name: "Community Star", icon: "star-outline", category: "Honor" },
    { threshold: 2000, name: "Guardian Angel", icon: "star", category: "Honor" },
    { threshold: 3000, name: "Kindness Hero", icon: "heart-outline", category: "Honor" },
    { threshold: 4000, name: "Life Changer", icon: "heart", category: "Ambassador" },
    { threshold: 5000, name: "Philanthropist", icon: "ribbon-outline", category: "Ambassador" },
    { threshold: 6000, name: "Legendary Caretaker", icon: "ribbon", category: "Ambassador" },
    { threshold: 7500, name: "Global Giving King", icon: "planet-outline", category: "Legend" },
    { threshold: 10000, name: "Ultimate Humanitarian", icon: "planet", category: "Legend" },
];

// Generate more levels up to 50 if needed
for (let i = 14; i <= 50; i++) {
    BADGE_LEVELS.push({
        threshold: 10000 + (i - 13) * 2000,
        name: `Elite Giver Level ${i}`,
        icon: "medal-outline",
        category: "Elite"
    });
}

const checkAndAwardBadges = async (user) => {
    let updated = false;
    const currentPoints = user.points || 0;
    const currentBadgeNames = user.badges.map(b => b.name);

    for (const badge of BADGE_LEVELS) {
        if (currentPoints >= badge.threshold && !currentBadgeNames.includes(badge.name)) {
            user.badges.push({
                name: badge.name,
                icon: badge.icon,
                category: badge.category,
                earnedAt: new Date()
            });
            updated = true;
        }
    }

    if (updated) {
        // Update level based on number of badges
        user.level = user.badges.length + 1;
        await user.save();
    }

    return updated;
};

module.exports = { BADGE_LEVELS, checkAndAwardBadges };
