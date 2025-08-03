<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>FutLog / Main Page</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Link to your CSS file -->
    <link rel="stylesheet" href="/css/style.css">
    <!-- Font Awesome for icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
</head>
<body>
    <div class="sidebar">
        <div class="sidebar-header">
            <h2>Futlog</h2>
            <i class="fa fa-bars"></i>
        </div>
        <ul class="sidebar-menu">
            <a href="index.php" id="active-page"><i class="fa fa-home"></i> Feed</a>
            <a href="leaderboard.html"><i class="fa fa-star"></i> Leaderboard</a>
            <a href="watched.html"><i class="fa fa-eye"></i> Watched</a>
            <a href="leagues.html"><i class="fa fa-calendar-o"></i> Leagues</a>
            <a href="predict.html"><i class="fa fa-lightbulb-o"></i> Predict</a>
            <a href="store.html"><i class="fa fa-shopping-cart"></i> Store</a>
            <a href="people.html"><i class="fa fa-group"></i> People</a>
            <a href="#"><i class="fa fa-gear"></i> Settings</a>
            <a href="help.html"><i class="fa fa-question-circle-o"></i> Help</a>
        </ul>
    </div>

    <div class="main-feed">
        <div class="searchbar-container">
            <div class="searchbar">
                <input type="text" placeholder="Search...">
            </div>
            <div class="searchbar-container-info">
                <a href="#">Notifications</a>
                <a href="#">Messages</a>
                <a href="profile.html"><i class="fa fa-user-circle-o"></i></a>
            </div>
        </div>

        <div class="main-page-elements">
            <div class="scrolling-feed">
                <?php
                $token = 'YOUR_API_TOKEN_HERE'; // Replace this
                $url = 'https://api.football-data.org/v4/competitions/PD/matches?status=SCHEDULED';
                $ch = curl_init($url);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    'X-Auth-Token: ' . $token
                ]);
                $response = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);

                if ($httpCode !== 200) {
                    echo "<p>API returned status code $httpCode. Check token or quota.</p>";
                } else {
                    $data = json_decode($response, true);
                    if (isset($data['matches'])) {
                        foreach (array_slice($data['matches'], 0, 5) as $match) {
                            $home = $match['homeTeam']['name'];
                            $away = $match['awayTeam']['name'];
                            $datetime = new DateTime($match['utcDate']);
                            $date = $datetime->format('F j, Y');
                            $time = $datetime->format('H:i');
                            $venue = $match['venue'] ?? 'TBD';

                            echo '
                            <div class="feed-item">
                                <div class="feed-item-body">
                                    <div class="feed-item-body-title">
                                        <img src="/img/laliga.png" alt="">
                                        <div class="feed-title-holder">
                                            <h2>' . htmlspecialchars($home) . ' vs ' . htmlspecialchars($away) . '</h2>
                                        </div>
                                    </div>
                                    <div class="feed-item-body-details">
                                        <i class="fa fa-futbol-o"></i>
                                        <div class="feed-match-info">
                                            <span>' . $date . '</span>
                                            <span>Venue: ' . htmlspecialchars($venue) . '</span>
                                            <span>' . $time . '</span>
                                        </div>
                                        <i class="fa fa-futbol-o"></i>
                                    </div>
                                </div>
                                <div class="feed-item-interactions">
                                    <div class="feed-item-interactions-users">
                                        <i class="fa fa-user-circle-o"></i>
                                        <i class="fa fa-user-circle-o"></i>
                                        <i class="fa fa-user-circle-o"></i>
                                        <span>+3 Likes</span>
                                    </div>
                                    <div class="interaction-buttons">
                                        <div class="feed-item-interactions-like">
                                            <button type="button"><i class="fa fa-heart-o"></i>Like</button>
                                        </div>
                                        <div class="feed-item-interactions-comment">
                                            <button type="button"><i class="fa fa-comment-o"></i>Comment</button>
                                        </div>
                                        <div class="feed-item-interactions-predict">
                                            <button type="button"><i class="fa fa-lightbulb-o"></i>Predict</button>
                                        </div>
                                        <div class="feed-item-interactions-share">
                                            <button type="button"><i class="fa fa-share"></i>Share</button>
                                        </div>
                                    </div>
                                </div>
                            </div>';
                        }
                    } else {
                        echo '<p>No match data found.</p>';
                    }
                }
                ?>
            </div>

            <div class="fixed-suggested">
                <div class="fixed-suggested-header">
                    <h2>Suggested for you</h2>
                    <a href="people.html">See All</a>
                </div>
                <div class="fixed-suggested-list">
                    <ul>
                        <div class="suggested-profile">
                            <i class="fa fa-user-circle-o"></i>
                            <div class="fixed-profiles">
                                <p>John Doe</p>
                                <p>Arsenal</p>
                            </div>
                        </div>
                        <div class="suggested-profile">
                            <i class="fa fa-user-circle-o"></i>
                            <div class="fixed-profiles">
                                <p>Jane Smith</p>
                                <p>Barcelona</p>
                            </div>
                        </div>
                        <div class="suggested-profile">
                            <i class="fa fa-user-circle-o"></i>
                            <div class="fixed-profiles">
                                <p>Alex Lee</p>
                                <p>Man City</p>
                            </div>
                        </div>
                    </ul>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
