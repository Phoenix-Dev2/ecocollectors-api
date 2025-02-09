const jwt = require("jsonwebtoken");
const executeQuery = require("../dbHelper");

const getWelcomeAdminData = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    jwt.verify(token, "jwtkey");

    // Define queries
    const queries = {
      totalRequests: `SELECT COUNT(*) AS totalRequests FROM user_requests`,
      totalRecycledBottles: `SELECT SUM(bottles_number) AS totalRecycledBottles FROM user_requests`,
      avgClosingTime: `
        SELECT AVG(TIMESTAMPDIFF(SECOND, request_date, completed_date)) AS avgClosingTime
        FROM user_requests WHERE completed_date IS NOT NULL
      `,
      activeBinsCount: `SELECT COUNT(*) AS activeBinsCount FROM markers WHERE active = 1`,
      totalCompletedRequests: `SELECT COUNT(*) AS totalCompletedRequests FROM user_requests WHERE status = 3`,
      currentMonthCollectedBottles: `
        SELECT SUM(bottles_number) AS currentMonthCollectedBottles
        FROM user_requests
        WHERE recycler_id IS NOT NULL
        AND completed_date IS NOT NULL
        AND YEAR(completed_date) = YEAR(NOW()) 
        AND MONTH(completed_date) = MONTH(NOW())
      `,
    };

    // Execute all queries concurrently
    const results = await Promise.all(
      Object.values(queries).map((query) => executeQuery(query))
    );

    // Extract results
    const totalRequests = results[0][0].totalRequests || 0;
    const totalRecycledBottles = results[1][0].totalRecycledBottles || 0;
    const avgClosingTimeInSeconds = results[2][0].avgClosingTime || 0;
    const activeBinsCount = results[3][0].activeBinsCount || 0;
    const totalCompletedRequests = results[4][0].totalCompletedRequests || 0;
    const currentMonthCollectedBottles =
      results[5][0].currentMonthCollectedBottles || 0;

    // Convert avgClosingTime from seconds to days, hours, minutes
    const avgClosingTimeInMinutes = Math.floor(avgClosingTimeInSeconds / 60);
    const days = Math.floor(avgClosingTimeInMinutes / 1440);
    const hours = Math.floor((avgClosingTimeInMinutes % 1440) / 60);
    const minutes = avgClosingTimeInMinutes % 60;

    res.json({
      totalRequests,
      totalRecycledBottles,
      avgClosingTime: `${days} days ${hours} hours ${minutes} minutes`,
      activeBinsCount,
      totalCompletedRequests,
      currentMonthCollectedBottles,
    });
  } catch (error) {
    console.error("Error fetching admin data:", error);
    return res.status(500).json("Internal server error");
  }
};

module.exports = {
  getWelcomeAdminData: getWelcomeAdminData,
};
