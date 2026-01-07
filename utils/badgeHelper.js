const BADGE_LEVELS = [
    { threshold: 100, name: "Kind Starter", icon: "seed-outline", category: "Milestone", color: "#4ADE80" },
    { threshold: 250, name: "Bronze Donor", icon: "shield-outline", category: "Milestone", color: "#CD7F32" },
    { threshold: 500, name: "Silver Giver", icon: "shield-checkmark", category: "Milestone", color: "#C0C0C0" },
    { threshold: 750, name: "Gold Provider", icon: "trophy-outline", category: "Milestone", color: "#FFD700" },
    { threshold: 1000, name: "Platinum Helper", icon: "trophy", category: "Milestone", color: "#E5E4E2" },
    { threshold: 1500, name: "Community Star", icon: "star-outline", category: "Honor", color: "#60A5FA" },
    { threshold: 2000, name: "Guardian Angel", icon: "heart-circle", category: "Honor", color: "#F87171" },
    { threshold: 3000, name: "Kindness Hero", icon: "flash", category: "Honor", color: "#A78BFA" },
    { threshold: 4000, name: "Life Changer", icon: "leaf", category: "Ambassador", color: "#34D399" },
    { threshold: 5000, name: "Philanthropist", icon: "ribbon", category: "Ambassador", color: "#FB923C" },
    { threshold: 6000, name: "Legendary Caretaker", icon: "diamond", category: "Ambassador", color: "#38BDF8" },
    { threshold: 7500, name: "Global Giving King", icon: "planet", category: "Legend", color: "#818CF8" },
    { threshold: 10000, name: "Ultimate Humanitarian", icon: "infinite", category: "Legend", color: "#F472B6" },
];

const ICONS = ["medal", "ribbon", "star", "heart", "diamond", "planet", "infinite", "flash", "trophy", "shield"];

// Generate more levels up to 50 with rotating premium icons
for (let i = 14; i <= 50; i++) {
    const iconIndex = (i - 14) % ICONS.length;
    BADGE_LEVELS.push({
        threshold: 10000 + (i - 13) * 2000,
        name: `Elite Giver Level ${i}`,
        icon: ICONS[iconIndex],
        category: "Elite",
        color: i > 40 ? "#C084FC" : i > 25 ? "#FBBF24" : "#94A3B8"
    });
}

const checkAndAwardBadges = async (user) => {
    let updated = false;
    const currentPoints = user.points || 0;
    const currentBadgeNames = user.badges.map(b => b.name);
    const pendingBadgeNames = (user.pendingBadges || []).map(b => b.name);

    for (const badge of BADGE_LEVELS) {
        if (currentPoints >= badge.threshold && !currentBadgeNames.includes(badge.name) && !pendingBadgeNames.includes(badge.name)) {
            if (!user.pendingBadges) user.pendingBadges = [];
            user.pendingBadges.push({
                name: badge.name,
                icon: badge.icon,
                category: badge.category,
                threshold: badge.threshold,
                color: badge.color
            });
            updated = true;
        }
    }

    if (updated) {
        await user.save();
    }

    return updated;
};

module.exports = { BADGE_LEVELS, checkAndAwardBadges };
