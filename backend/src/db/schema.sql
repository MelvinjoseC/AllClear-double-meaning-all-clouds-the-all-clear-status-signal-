-- ==============================================================================
-- CLOUDMON DATABASE SCHEMA & ROW-LEVEL SECURITY DEFINITION
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    whatsapp_number VARCHAR(50), -- Tenant WhatsApp alert routing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users Table (Belongs to a Tenant)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Monitored Items (Servers or URL endpoints)
CREATE TABLE IF NOT EXISTS monitored_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('server', 'url')),
    name VARCHAR(255) NOT NULL,
    url VARCHAR(2048), -- Nullable for servers, mandatory for URLs
    cloud_provider VARCHAR(50) DEFAULT 'other' CHECK (cloud_provider IN ('aws', 'gcp', 'azure', 'digitalocean', 'baremetal', 'other')),
    status VARCHAR(50) NOT NULL DEFAULT 'green' CHECK (status IN ('green', 'yellow', 'red')),
    last_checked_at TIMESTAMP WITH TIME ZONE,
    uptime_percentage NUMERIC(5, 2) DEFAULT 100.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Agent Tokens (Hashed bearer tokens mapping to a specific monitored server)
CREATE TABLE IF NOT EXISTS agent_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    monitored_item_id UUID UNIQUE REFERENCES monitored_items(id) ON DELETE CASCADE NOT NULL,
    token_hash VARCHAR(255) NOT NULL, -- Hashed token
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Alert History Log
CREATE TABLE IF NOT EXISTS alert_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    monitored_item_id UUID REFERENCES monitored_items(id) ON DELETE CASCADE NOT NULL,
    alert_name VARCHAR(255) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL, -- firing, resolved, suppressed_maintenance
    message TEXT NOT NULL,
    suggested_action TEXT NOT NULL,
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. SSL / TLS Certificates Monitoring Table
CREATE TABLE IF NOT EXISTS ssl_certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    monitored_item_id UUID UNIQUE REFERENCES monitored_items(id) ON DELETE CASCADE NOT NULL,
    domain VARCHAR(255) NOT NULL,
    issuer VARCHAR(255),
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_to TIMESTAMP WITH TIME ZONE,
    days_remaining INT,
    status VARCHAR(50) NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'expiring_soon', 'expired', 'error')),
    last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Maintenance Windows Table (Suppresses alerts during planned downtime)
CREATE TABLE IF NOT EXISTS maintenance_windows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    monitored_item_id UUID REFERENCES monitored_items(id) ON DELETE CASCADE, -- Null means tenant-wide
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Multi-Channel Notification Dispatcher Targets
CREATE TABLE IF NOT EXISTS notification_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    channel_type VARCHAR(50) NOT NULL CHECK (channel_type IN ('slack', 'discord', 'telegram', 'webhook', 'whatsapp', 'email')),
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- FORCE ROW LEVEL SECURITY to ensure RLS applies to table owners (the application user)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

ALTER TABLE monitored_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitored_items FORCE ROW LEVEL SECURITY;

ALTER TABLE agent_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tokens FORCE ROW LEVEL SECURITY;

ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history FORCE ROW LEVEL SECURITY;

ALTER TABLE ssl_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssl_certificates FORCE ROW LEVEL SECURITY;

ALTER TABLE maintenance_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_windows FORCE ROW LEVEL SECURITY;

ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_channels FORCE ROW LEVEL SECURITY;

-- Drop existing policies if script is run multiple times
DROP POLICY IF EXISTS tenant_users_policy ON users;
DROP POLICY IF EXISTS tenant_monitored_items_policy ON monitored_items;
DROP POLICY IF EXISTS tenant_agent_tokens_policy ON agent_tokens;
DROP POLICY IF EXISTS tenant_alert_history_policy ON alert_history;
DROP POLICY IF EXISTS tenant_ssl_certificates_policy ON ssl_certificates;
DROP POLICY IF EXISTS tenant_maintenance_windows_policy ON maintenance_windows;
DROP POLICY IF EXISTS tenant_notification_channels_policy ON notification_channels;

-- Create Tenant Separation Policies
CREATE POLICY tenant_users_policy ON users
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::UUID);

CREATE POLICY tenant_monitored_items_policy ON monitored_items
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::UUID);

CREATE POLICY tenant_agent_tokens_policy ON agent_tokens
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::UUID);

CREATE POLICY tenant_alert_history_policy ON alert_history
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::UUID);

CREATE POLICY tenant_ssl_certificates_policy ON ssl_certificates
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::UUID);

CREATE POLICY tenant_maintenance_windows_policy ON maintenance_windows
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::UUID);

CREATE POLICY tenant_notification_channels_policy ON notification_channels
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::UUID);

-- ==============================================================================
-- SECURITY DEFINER FUNCTION BYPASSES
-- ==============================================================================
-- These functions run with the privileges of the function owner (creator),
-- which bypasses RLS rules. They allow the backend to bootstrap authentication.
-- ==============================================================================

CREATE OR REPLACE FUNCTION get_user_by_email(p_email VARCHAR)
RETURNS TABLE(
    id UUID, 
    tenant_id UUID, 
    email VARCHAR, 
    password_hash VARCHAR
) 
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY 
    SELECT u.id, u.tenant_id, u.email, u.password_hash 
    FROM users u 
    WHERE u.email = p_email;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION find_item_by_token_hash(p_token_hash VARCHAR)
RETURNS TABLE(
    token_id UUID,
    tenant_id UUID,
    monitored_item_id UUID
)
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.tenant_id, t.monitored_item_id
    FROM agent_tokens t
    WHERE t.token_hash = p_token_hash;
END;
$$ LANGUAGE plpgsql;
