const jwt = require("jsonwebtoken");
const executeQuery = require("../dbHelper");

const WelcomeUserData = async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json("Not authenticated");

    const decodedToken = jwt.verify(token, "jwtkey");
    const userId = decodedToken.id;

    // Define queries
    const queries = {
      totalRequests: `
        SELECT COUNT(*) AS totalRequests 
        FROM user_requests 
        WHERE user_id = ?
      `,
      totalRecycledBottles: `
        SELECT SUM(bottles_number) AS totalRecycledBottles 
        FROM user_requests 
        WHERE user_id = ?
      `,
      avgClosingTime: `
        SELECT AVG(TIMESTAMPDIFF(SECOND, request_date, completed_date)) AS avgClosingTime 
        FROM user_requests 
        WHERE user_id = ? 
        AND completed_date IS NOT NULL
      `,
      totalCompletedRequests: `
        SELECT COUNT(*) AS totalCompletedRequests 
        FROM user_requests 
        WHERE status = 3 
        AND user_id = ?
      `,
      last3RecyclersNames: `
        SELECT full_name 
        FROM user_requests 
        WHERE completed_date IS NOT NULL 
        AND user_id = ? 
        ORDER BY completed_date DESC 
        LIMIT 3
      `,
      currentMonthRecycledBottles: `
        SELECT SUM(bottles_number) AS currentMonthRecycledBottles 
        FROM user_requests 
        WHERE recycler_id IS NOT NULL 
        AND completed_date IS NOT NULL 
        AND user_id = ? 
        AND YEAR(completed_date) = YEAR(NOW()) 
        AND MONTH(completed_date) = MONTH(NOW())
      `,
    };

    // Execute all queries concurrently
    const results = await Promise.all(
      Object.values(queries).map((query) => executeQuery(query, [userId]))
    );

    // Extract results
    const totalRequests = results[0][0]?.totalRequests || 0;
    const totalRecycledBottles = results[1][0]?.totalRecycledBottles || 0;
    const avgClosingTimeInSeconds = results[2][0]?.avgClosingTime || 0;
    const totalCompletedRequests = results[3][0]?.totalCompletedRequests || 0;
    const last3RecyclersNames = results[4] || [];
    const currentMonthRecycledBottles =
      results[5][0]?.currentMonthRecycledBottles || 0;

    // Convert avgClosingTime from seconds to days, hours, and minutes
    const avgClosingTimeInMinutes = Math.floor(avgClosingTimeInSeconds / 60);
    const days = Math.floor(avgClosingTimeInMinutes / 1440);
    const hours = Math.floor((avgClosingTimeInMinutes % 1440) / 60);
    const minutes = avgClosingTimeInMinutes % 60;

    res.json({
      totalRequests,
      totalRecycledBottles,
      avgClosingTime: `${days} days ${hours} hours ${minutes} minutes`,
      totalCompletedRequests,
      last3RecyclersNames,
      currentMonthRecycledBottles,
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    return res.status(500).json("Internal server error");
  }
};

module.exports = {
  WelcomeUserData: WelcomeUserData,
};
