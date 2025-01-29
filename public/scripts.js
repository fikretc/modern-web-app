/* public/scripts.js */
document.getElementById('login-form').addEventListener('submit', async function(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const response = await fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    });
    const result = await response.json();
    if (result.success) {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('map-container').style.display = 'block';
        initializeMap();
    } else {
        alert('Login failed');
    }
});

document.getElementById('register-form').addEventListener('submit', async function(event) {
    event.preventDefault();
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const response = await fetch('/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    });
    const result = await response.json();
    if (result.success) {
        alert('Registration successful');
    } else {
        alert('Registration failed: ' + result.message);
    }
});

function initializeMap() {
    // Initialize the map with specified coordinates
    const initialLat = 39.9207759;
    const initialLon = 32.8540497;
    const map = L.map('map').setView([initialLat, initialLon], 13); // Coordinates for the specified location

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    let currentMarker = L.marker([initialLat, initialLon]).addTo(map);
    let markerPoints = [[initialLat, initialLon]]; // Array to store marker points
    let polyline = null; // Reference to the polyline

    // Function to calculate distance between two coordinates using Haversine formula
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius of the Earth in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
    }

    // Function to update the total distance
    function updateTotalDistance() {
        let totalDistance = 0;
        for (let i = 1; i < markerPoints.length; i++) {
            totalDistance += calculateDistance(markerPoints[i-1][0], markerPoints[i-1][1], markerPoints[i][0], markerPoints[i][1]);
        }
        document.getElementById('total-distance').textContent = totalDistance.toFixed(2);
    }

    // Form submit event for location
    document.getElementById('location-form').addEventListener('submit', async function(event) {
        event.preventDefault();
        const country = document.getElementById('country').value;
        const city = document.getElementById('city').value;
        const response = await fetch(`https://nominatim.openstreetmap.org/search?country=${country}&city=${city}&format=json`);
        const data = await response.json();
        if (data.length > 0) {
            const { lat, lon } = data[0];
            moveMapCenter(lat, lon);
            document.getElementById('latitude').textContent = lat;
            document.getElementById('longitude').textContent = lon;
        } else {
            alert('Location not found');
        }
    });

    // Function to move map center to the selected location
    function moveMapCenter(lat, lon) {
        map.setView([lat, lon], 13);
        if (currentMarker) {
            map.removeLayer(currentMarker);
        }
        currentMarker = L.marker([lat, lon]).addTo(map);
        markerPoints.push([lat, lon]);
        if (markerPoints.length > 5) {
            markerPoints.shift(); // Keep only the last 5 points
        }
        drawPolyline();
        updateTotalDistance();
    }

    // Function to draw polyline between the last 5 marker points
    function drawPolyline() {
        if (polyline) {
            map.removeLayer(polyline); // Remove the existing polyline
        }
        if (markerPoints.length > 1) {
            polyline = L.polyline(markerPoints, { color: 'blue' }).addTo(map);
        }
    }

    // Add click event listener to the map with a timer for double-click detection
    let clickTimeout;
    map.on('click', function(e) {
        if (clickTimeout) {
            clearTimeout(clickTimeout);
            clickTimeout = null;
            // Handle double-click event (zoom in/out)
            if (map.getZoom() < 18) {
                map.zoomIn();
            } else {
                map.zoomOut();
            }
        } else {
            clickTimeout = setTimeout(() => {
                clickTimeout = null;
                // Handle single-click event (move center and marker)
                const { lat, lng } = e.latlng;
                moveMapCenter(lat, lng);
                document.getElementById('latitude').textContent = lat;
                document.getElementById('longitude').textContent = lng;
                saveClickEvent(lat, lng);
            }, 300); // Adjust the timeout duration as needed
        }
    });

    // Function to save click event to the server
    async function saveClickEvent(lat, lon) {
        const response = await fetch('/save-click', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ lat, lon })
        });
        if (!response.ok) {
            console.error('Error saving click event');
        }
    }

    // Show the distance container when the map is displayed
    document.getElementById('map-container').style.display = 'block';
    document.getElementById('distance-container').style.display = 'block';
}

// Function to handle logout
async function logout() {
    const response = await fetch('/logout', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    if (response.ok) {
        window.location.href = '/';
    } else {
        alert('Logout failed');
    }
}
