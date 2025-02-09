const jwt = require("jsonwebtoken");
const executeQuery = require("../dbHelper");

const WelcomeManagerData = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    jwt.verify(token, "jwtkey");

    // Define queries
    const queries = {
      totalPickedUpRequests: `
        SELECT COUNT(*) AS totalPickedUpRequests 
        FROM user_requests 
        WHERE recycler_id IS NOT NULL
      `,
      totalRecycledBottles: `
        SELECT SUM(bottles_number) AS totalRecycledBottles 
        FROM user_requests 
        WHERE recycler_id IS NOT NULL
      `,
      avgClosingTime: `
        SELECT AVG(TIMESTAMPDIFF(SECOND, request_date, completed_date)) AS avgClosingTime 
        FROM user_requests 
        WHERE recycler_id IS NOT NULL 
        AND completed_date IS NOT NULL
      `,
      currentMonthCollectedBottles: `
        SELECT SUM(bottles_number) AS currentMonthCollectedBottles 
        FROM user_requests 
        WHERE recycler_id IS NOT NULL 
        AND completed_date IS NOT NULL 
        AND YEAR(completed_date) = YEAR(NOW()) 
        AND MONTH(completed_date) = MONTH(NOW())
      `,
      last3CompletedRequests: `
        SELECT full_name, req_address, bottles_number 
        FROM user_requests 
        WHERE completed_date IS NOT NULL 
        ORDER BY completed_date DESC 
        LIMIT 3
      `,
      activeBinsCount: `
        SELECT COUNT(*) AS activeBinsCount 
        FROM markers 
        WHERE active = 1
      `,
    };

    // Execute all queries concurrently
    const results = await Promise.all(
      Object.values(queries).map((query) => executeQuery(query))
    );

    // Extract results
    const totalPickedUpRequests = results[0][0].totalPickedUpRequests || 0;
    const totalRecycledBottles = results[1][0].totalRecycledBottles || 0;
    const avgClosingTimeInSeconds = results[2][0].avgClosingTime || 0;
    const currentMonthCollectedBottles =
      results[3][0].currentMonthCollectedBottles || 0;
    const last3CompletedRequests = results[4] || [];
    const activeBinsCount = results[5][0].activeBinsCount || 0;

    // Convert avgClosingTime from seconds to days, hours, and minutes
    const avgClosingTimeInMinutes = Math.floor(avgClosingTimeInSeconds / 60);
    const days = Math.floor(avgClosingTimeInMinutes / 1440);
    const hours = Math.floor((avgClosingTimeInMinutes % 1440) / 60);
    const minutes = avgClosingTimeInMinutes % 60;

    res.json({
      totalPickedUpRequests,
      totalRecycledBottles,
      currentMonthCollectedBottles,
      avgClosingTime: `${days} days ${hours} hours ${minutes} minutes`,
      last3CompletedRequests,
      activeBinsCount,
    });
  } catch (error) {
    console.error("Error fetching manager data:", error);
    return res.status(500).json("Internal server error");
  }
};

module.exports = {
  WelcomeManagerData: WelcomeManagerData,
};
