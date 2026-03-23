console.log("Starting DB initialization script...");

// made by gemini
(async () => {
    try {
        console.log("Importing Unit...");
        const { Unit } = await import("../data/unit");
        console.log("Unit imported. Initializing database...");

        const unit = new Unit(true);
        unit.complete(null);

        console.log("Database initialized successfully at: " + process.cwd());
    } catch (error) {
        console.error("Error initializing database:", error);
        process.exit(1);
    }
})();
