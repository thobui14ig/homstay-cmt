CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    expired_at TIMESTAMP NOT NULL,
    link_on_limit INTEGER DEFAULT NULL,
    link_off_limit INTEGER DEFAULT NULL,
    level INTEGER DEFAULT 0, -- 0: USER, 1: ADMIN
    delay_on_private INTEGER DEFAULT 5,
    get_phone BOOLEAN DEFAULT TRUE,
    account_fb_uuid TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE link_status AS ENUM ('pending', 'started');

-- Enum cho LinkType
CREATE TYPE link_type AS ENUM ('die', 'undefined', 'public', 'private');

-- Enum cho HideBy
CREATE TYPE hide_by AS ENUM ('all', 'phone', 'keywords');

CREATE TABLE links (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    link_name VARCHAR(255),
    content TEXT,
    link_url VARCHAR(255) NOT NULL,
    post_id VARCHAR(255),
    post_id_v1 VARCHAR(255),
    page_id VARCHAR(255),
    last_comment_time TIMESTAMP,
    time_craw_update TIMESTAMP,
    comment_count INT DEFAULT 0,
    delay_time INT DEFAULT 0,
    "like" INT DEFAULT 0,
    status link_status DEFAULT 'pending' NOT NULL,
    type link_type NOT NULL,
    error_message VARCHAR(255),
    process BOOLEAN DEFAULT FALSE,
    count_before INT NOT NULL,
    count_after INT NOT NULL,
    like_before INT NOT NULL,
    like_after INT NOT NULL,
    hide_cmt BOOLEAN NOT NULL,
    hide_by hide_by DEFAULT 'all' NOT NULL,
    post_id_die BOOLEAN NOT NULL,
    post_id_v1_die BOOLEAN NOT NULL,
    thread INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_links_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TYPE token_status AS ENUM ('active', 'inactive', 'limit', 'die');
CREATE TABLE token (
    id SERIAL PRIMARY KEY,
    token_value VARCHAR(255) NOT NULL,
    token_value_v1 VARCHAR(255) NOT NULL,
    status token_status DEFAULT 'active' NOT NULL,
    type SMALLINT DEFAULT 1 NOT NULL, 
    retry_count INT DEFAULT 0
);

CREATE TABLE delay (
    id SERIAL PRIMARY KEY,
    refresh_cookie INT DEFAULT 0,
    updated_at TIMESTAMP NOT NULL,
    refresh_token INT DEFAULT 0,
    refresh_proxy INT DEFAULT 0,
    delay_on_public INT DEFAULT 0,
    delay_off_private INT DEFAULT 0,
    delay_off INT DEFAULT 0,
    delay_comment_count INT DEFAULT 0,
    time_remove_proxy_slow INT DEFAULT 0
);

CREATE TABLE keywords (
    id SERIAL PRIMARY KEY,
    keyword TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INT NOT NULL,
    link_id INT NOT NULL,
    CONSTRAINT fk_keywords_link FOREIGN KEY (link_id) REFERENCES links(id)
);

CREATE TYPE proxy_status AS ENUM ('active', 'inactive');

CREATE TABLE proxy (
    id SERIAL PRIMARY KEY,
    proxy_address VARCHAR(100) NOT NULL,
    status proxy_status DEFAULT 'active' NOT NULL,
    is_fb_block BOOLEAN DEFAULT FALSE NOT NULL,
    error_code TEXT
);

-- Tạo ENUM cho CookieStatus
CREATE TYPE cookie_status AS ENUM ('active', 'inactive', 'limit', 'die');

CREATE TABLE cookie (
    id SERIAL PRIMARY KEY,
    cookie TEXT NOT NULL,
    created_by INT NOT NULL,
    fb_id TEXT NOT NULL,
    fb_dtsg TEXT NOT NULL,
    jazoest TEXT NOT NULL,
    token VARCHAR(255) NOT NULL,
    status cookie_status DEFAULT 'active' NOT NULL,
    CONSTRAINT fk_cookie_user FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    post_id VARCHAR(255) NOT NULL,
    user_id INT NOT NULL,
    uid VARCHAR(255),
    name VARCHAR(255),
    message TEXT,
    time_created TIMESTAMP,
    phone_number VARCHAR(255),
    cmtid VARCHAR(255) NOT NULL,
    link_id INT NOT NULL,
    hide_cmt BOOLEAN NOT NULL,
    CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_comments_link FOREIGN KEY (link_id) REFERENCES links(id)
);