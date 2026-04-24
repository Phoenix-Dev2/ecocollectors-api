const jwt = require("jsonwebtoken");
const executeQuery = require("../dbHelper");

const getWelcomeAdminData = async (req, res) => {
  try {
    const token = req.cookies.access_token || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json("Not authenticated");

    const decodedToken = jwt.verify(token, "jwtkey");

    // Define queries
    const queries = {
      stats: `
        SELECT 
          COUNT(*) AS totalRequests,
          SUM(bottles_number) AS totalRecycledBottles,
          AVG(CASE WHEN completed_date IS NOT NULL THEN TIMESTAMPDIFF(SECOND, request_date, completed_date) END) AS avgClosingTime,
          COUNT(CASE WHEN status = 3 THEN 1 END) AS totalCompletedRequests,
          (SELECT COUNT(*) FROM markers WHERE active = 1) AS activeBinsCount,
          SUM(CASE WHEN recycler_id IS NOT NULL AND completed_date IS NOT NULL AND YEAR(completed_date) = YEAR(NOW()) AND MONTH(completed_date) = MONTH(NOW()) THEN bottles_number ELSE 0 END) AS currentMonthCollectedBottles
        FROM user_requests
      `,
    };

    // Execute queries concurrently (now only 1)
    const results = await Promise.all([
      executeQuery(queries.stats)
    ]);

    // Extract results
    const stats = results[0][0] || {};
    const totalRequests = stats.totalRequests || 0;
    const totalRecycledBottles = stats.totalRecycledBottles || 0;
    const avgClosingTimeInSeconds = stats.avgClosingTime || 0;
    const activeBinsCount = stats.activeBinsCount || 0;
    const totalCompletedRequests = stats.totalCompletedRequests || 0;
    const currentMonthCollectedBottles = stats.currentMonthCollectedBottles || 0;

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
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json("Invalid or expired token");
    }
    return res.status(500).json("Internal server error");
  }
};

module.exports = {
  getWelcomeAdminData: getWelcomeAdminData,
};
