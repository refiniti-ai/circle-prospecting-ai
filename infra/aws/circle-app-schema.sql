-- Circle Prospecting business data (orders, logins, purchases).
-- Database: circle (empty today). Listings stay in roofs — do not run this on roofs.
-- User `circle` has full access here. Safe to re-run (IF NOT EXISTS).
-- Google/Firestore remains the live source until we switch reads.

CREATE DATABASE IF NOT EXISTS `circle` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `circle`;

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) NOT NULL,
  internal_id INT NULL,
  mls VARCHAR(40) NULL,
  payload JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_orders_mls (mls),
  KEY idx_orders_internal (internal_id)
);

CREATE TABLE IF NOT EXISTS purchases (
  session_id VARCHAR(128) NOT NULL,
  order_number VARCHAR(64) NOT NULL,
  notified_at VARCHAR(40) NOT NULL,
  checkout_type VARCHAR(64) NOT NULL,
  customer_email VARCHAR(255) NULL,
  amount_total_cents INT NULL,
  currency VARCHAR(8) NULL,
  mls VARCHAR(40) NULL,
  payload JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (session_id),
  KEY idx_purchases_email (customer_email),
  KEY idx_purchases_notified (notified_at)
);

CREATE TABLE IF NOT EXISTS checkout_funnel (
  session_id VARCHAR(128) NOT NULL,
  status VARCHAR(24) NOT NULL,
  source VARCHAR(40) NOT NULL,
  checkout_type VARCHAR(64) NOT NULL,
  mls VARCHAR(40) NULL,
  started_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  payload JSON NOT NULL,
  PRIMARY KEY (session_id),
  KEY idx_funnel_status (status),
  KEY idx_funnel_started (started_at)
);

CREATE TABLE IF NOT EXISTS client_accounts (
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  salt VARCHAR(255) NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (email)
);

CREATE TABLE IF NOT EXISTS client_delivery_leads (
  id VARCHAR(64) NOT NULL,
  sold_to_email VARCHAR(255) NOT NULL,
  stripe_session_id VARCHAR(128) NULL,
  mls VARCHAR(40) NULL,
  payload JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_leads_email (sold_to_email)
);

CREATE TABLE IF NOT EXISTS pay_link_clicks (
  id VARCHAR(64) NOT NULL,
  contact_id VARCHAR(64) NOT NULL,
  mls VARCHAR(40) NULL,
  clicked_at VARCHAR(40) NOT NULL,
  payload JSON NOT NULL,
  PRIMARY KEY (id),
  KEY idx_clicks_contact (contact_id)
);

CREATE TABLE IF NOT EXISTS search_catcher (
  id VARCHAR(64) NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  kind VARCHAR(24) NOT NULL,
  query_text VARCHAR(255) NOT NULL,
  payload JSON NOT NULL,
  PRIMARY KEY (id),
  KEY idx_search_created (created_at)
);

CREATE TABLE IF NOT EXISTS intro_listing_snapshots (
  mls VARCHAR(40) NOT NULL,
  payload JSON NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (mls)
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token VARCHAR(128) NOT NULL,
  kind VARCHAR(24) NOT NULL,
  email VARCHAR(255) NOT NULL,
  expires_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (token)
);

CREATE TABLE IF NOT EXISTS site_credentials (
  id VARCHAR(32) NOT NULL,
  payload JSON NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (id)
);
