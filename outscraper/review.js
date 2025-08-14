/**
 * Review tab functionality using Outscraper API
 */

class ReviewManager {
    constructor() {
        this.apiBase = '/api/outscraper';
        this.currentBusinesses = [];
        this.currentBusiness = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Search form
        const searchForm = document.getElementById('review-search-form');
        if (searchForm) {
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSearch();
            });
        }

        // Sort dropdown
        const sortSelect = document.getElementById('review-sort');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                if (this.currentBusiness) {
                    this.loadReviews(this.currentBusiness.place_id, sortSelect.value);
                }
            });
        }
    }

    async handleSearch() {
        const query = document.getElementById('review-query').value.trim();
        const location = document.getElementById('review-location').value.trim();

        if (!query) {
            this.showNotification('Please enter a search term', 'warning');
            return;
        }

        this.showLoading('search-results');

        try {
            const response = await fetch(`${this.apiBase}/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    location,
                    limit: 20
                })
            });

            if (!response.ok) {
                throw new Error(`Search failed: ${response.statusText}`);
            }

            const data = await response.json();
            this.currentBusinesses = data.businesses;
            this.displaySearchResults(data.businesses);

        } catch (error) {
            console.error('Search error:', error);
            this.showError('search-results', 'Failed to search businesses. Please try again.');
        }
    }

    displaySearchResults(businesses) {
        const container = document.getElementById('search-results');
        
        if (!businesses || businesses.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <p>No businesses found. Try a different search term or location.</p>
                </div>
            `;
            return;
        }

        const html = businesses.map(business => `
            <div class="business-card" data-place-id="${business.place_id}">
                <div class="business-header">
                    <h3>${this.escapeHtml(business.name)}</h3>
                    ${business.rating ? `
                        <div class="rating">
                            <span class="stars">${this.getStars(business.rating)}</span>
                            <span class="rating-value">${business.rating}</span>
                            ${business.reviews ? `<span class="review-count">(${business.reviews} reviews)</span>` : ''}
                        </div>
                    ` : ''}
                </div>
                <div class="business-info">
                    ${business.address ? `<p class="address">${this.escapeHtml(business.address)}</p>` : ''}
                    ${business.phone ? `<p class="phone">${this.escapeHtml(business.phone)}</p>` : ''}
                    ${business.website ? `<p class="website"><a href="${business.website}" target="_blank">Visit Website</a></p>` : ''}
                </div>
                <button class="view-reviews-btn" onclick="reviewManager.viewReviews('${business.place_id}')">
                    View Reviews
                </button>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    async viewReviews(placeId) {
        const business = this.currentBusinesses.find(b => b.place_id === placeId);
        if (!business) return;

        this.currentBusiness = business;
        
        // Show business details
        document.getElementById('selected-business-name').textContent = business.name;
        document.getElementById('selected-business-rating').innerHTML = 
            business.rating ? `${this.getStars(business.rating)} ${business.rating}` : 'No rating';
        
        document.getElementById('business-details').style.display = 'block';
        
        // Load reviews
        const sort = document.getElementById('review-sort').value;
        await this.loadReviews(placeId, sort);
    }

    async loadReviews(placeId, sort = 'most_relevant') {
        this.showLoading('reviews-container');

        try {
            const response = await fetch(`${this.apiBase}/reviews`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    place_id: placeId,
                    reviews_limit: 50,
                    sort: sort
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to load reviews: ${response.statusText}`);
            }

            const data = await response.json();
            this.displayReviews(data.reviews);

        } catch (error) {
            console.error('Reviews error:', error);
            this.showError('reviews-container', 'Failed to load reviews. Please try again.');
        }
    }

    displayReviews(reviews) {
        const container = document.getElementById('reviews-container');
        
        if (!reviews || reviews.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <p>No reviews found for this business.</p>
                </div>
            `;
            return;
        }

        const html = reviews.map(review => `
            <div class="review-card">
                <div class="review-header">
                    <div class="reviewer-info">
                        ${review.author_photo ? 
                            `<img src="${review.author_photo}" alt="${review.author_title}" class="reviewer-photo">` :
                            `<div class="reviewer-photo-placeholder">${this.getInitials(review.author_title)}</div>`
                        }
                        <div>
                            <h4>${this.escapeHtml(review.author_title)}</h4>
                            ${review.author_reviews_count ? 
                                `<p class="reviewer-stats">${review.author_reviews_count} reviews</p>` : ''
                            }
                        </div>
                    </div>
                    <div class="review-meta">
                        <div class="rating">${this.getStars(review.review_rating)}</div>
                        <div class="review-date">${this.formatDate(review.review_datetime_utc)}</div>
                    </div>
                </div>
                <div class="review-content">
                    <p>${this.escapeHtml(review.review_text || 'No written review')}</p>
                </div>
                ${review.owner_answer ? `
                    <div class="owner-response">
                        <h5>Response from owner</h5>
                        <p>${this.escapeHtml(review.owner_answer)}</p>
                    </div>
                ` : ''}
            </div>
        `).join('');

        container.innerHTML = html;
    }

    // Utility functions
    showLoading(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading...</p>
            </div>
        `;
    }

    showError(containerId, message) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="error-message">
                <p>${message}</p>
            </div>
        `;
    }

    showNotification(message, type = 'info') {
        // Use existing notification system if available
        if (window.piTextApp && window.piTextApp.dom) {
            window.piTextApp.dom.showNotification(message, type);
        } else {
            alert(message);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    getStars(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        let stars = '★'.repeat(fullStars);
        if (hasHalfStar) stars += '☆';
        return stars;
    }

    getInitials(name) {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }

    formatDate(dateString) {
        if (!dateString) return 'Unknown date';
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        return date.toLocaleDateString();
    }
}

// Initialize when DOM is ready
let reviewManager;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        reviewManager = new ReviewManager();
    });
} else {
    reviewManager = new ReviewManager();
}