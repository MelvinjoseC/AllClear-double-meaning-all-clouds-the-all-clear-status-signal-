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
    status VARCHAR(50) NOT NULL, -- firing, resolved
    message TEXT NOT NULL,
    suggested_action TEXT NOT NULL,
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ends_at TIMESTAMP WITH TIME ZONE,
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

-- Drop existing policies if script is run multiple times
DROP POLICY IF EXISTS tenant_users_policy ON users;
DROP POLICY IF EXISTS tenant_monitored_items_policy ON monitored_items;
DROP POLICY IF EXISTS tenant_agent_tokens_policy ON agent_tokens;
DROP POLICY IF EXISTS tenant_alert_history_policy ON alert_history;

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
