--
-- PostgreSQL database dump
--

\restrict N9WiTRCRmzsvPigZzBtEzeU1k0XctIGPpkKa8TTWavsJnNhhrOkero62b7mU3va

-- Dumped from database version 17.9
-- Dumped by pg_dump version 17.9

-- Started on 2026-07-18 15:26:02

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 885 (class 1247 OID 42536)
-- Name: qrcode_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.qrcode_type AS ENUM (
    'central',
    'department'
);


--
-- TOC entry 879 (class 1247 OID 42522)
-- Name: question_scope; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.question_scope AS ENUM (
    'central',
    'department'
);


--
-- TOC entry 876 (class 1247 OID 42516)
-- Name: question_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.question_type AS ENUM (
    'rating',
    'text'
);


--
-- TOC entry 882 (class 1247 OID 42528)
-- Name: respondent_group; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.respondent_group AS ENUM (
    'student',
    'staff',
    'public'
);


--
-- TOC entry 873 (class 1247 OID 42506)
-- Name: role_code; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.role_code AS ENUM (
    'admin',
    'exec',
    'dept_head',
    'staff'
);


SET default_table_access_method = heap;

--
-- TOC entry 234 (class 1259 OID 42710)
-- Name: answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.answers (
    id bigint NOT NULL,
    response_id bigint NOT NULL,
    question_id bigint NOT NULL,
    rating integer,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_rating_range CHECK (((rating IS NULL) OR ((rating >= 1) AND (rating <= 5))))
);


--
-- TOC entry 233 (class 1259 OID 42709)
-- Name: answers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.answers ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.answers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 242 (class 1259 OID 42975)
-- Name: department_central_question_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department_central_question_settings (
    department_id bigint NOT NULL,
    survey_id bigint NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 241 (class 1259 OID 42958)
-- Name: department_central_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department_central_questions (
    department_id bigint NOT NULL,
    question_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 244 (class 1259 OID 43070)
-- Name: department_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department_groups (
    id bigint NOT NULL,
    name text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 243 (class 1259 OID 43069)
-- Name: department_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.department_groups ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.department_groups_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 218 (class 1259 OID 42542)
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id bigint NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department_group_id bigint
);


--
-- TOC entry 217 (class 1259 OID 42541)
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.departments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.departments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 240 (class 1259 OID 42936)
-- Name: password_reset_otps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_otps (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    email character varying(150) NOT NULL,
    otp_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reset_token_hash text,
    verified_at timestamp with time zone
);


--
-- TOC entry 239 (class 1259 OID 42935)
-- Name: password_reset_otps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.password_reset_otps ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.password_reset_otps_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 236 (class 1259 OID 42734)
-- Name: qrcodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qrcodes (
    id bigint NOT NULL,
    type public.qrcode_type NOT NULL,
    department_id bigint,
    image_path text NOT NULL,
    link_target text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_qrcode_dept CHECK ((((type = 'central'::public.qrcode_type) AND (department_id IS NULL)) OR ((type = 'department'::public.qrcode_type) AND (department_id IS NOT NULL))))
);


--
-- TOC entry 235 (class 1259 OID 42733)
-- Name: qrcodes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.qrcodes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.qrcodes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 228 (class 1259 OID 42634)
-- Name: questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.questions (
    id bigint NOT NULL,
    survey_id bigint NOT NULL,
    scope public.question_scope NOT NULL,
    department_id bigint,
    type public.question_type NOT NULL,
    text text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_question_dept_scope CHECK ((((scope = 'central'::public.question_scope) AND (department_id IS NULL)) OR ((scope = 'department'::public.question_scope) AND (department_id IS NOT NULL))))
);


--
-- TOC entry 227 (class 1259 OID 42633)
-- Name: questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.questions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.questions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 238 (class 1259 OID 42752)
-- Name: rating_bands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rating_bands (
    id bigint NOT NULL,
    min_value numeric(3,1) NOT NULL,
    max_value numeric(3,1) NOT NULL,
    label_th text NOT NULL,
    sort_order integer NOT NULL,
    CONSTRAINT chk_band_range CHECK ((min_value <= max_value))
);


--
-- TOC entry 237 (class 1259 OID 42751)
-- Name: rating_bands_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.rating_bands ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.rating_bands_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 230 (class 1259 OID 42666)
-- Name: respondent_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.respondent_tokens (
    id bigint NOT NULL,
    token text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone
);


--
-- TOC entry 229 (class 1259 OID 42665)
-- Name: respondent_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.respondent_tokens ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.respondent_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 232 (class 1259 OID 42677)
-- Name: responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.responses (
    id bigint NOT NULL,
    survey_id bigint NOT NULL,
    department_id bigint NOT NULL,
    slot_id bigint NOT NULL,
    respondent_token_id bigint NOT NULL,
    respondent_group public.respondent_group NOT NULL,
    responded_date date NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 231 (class 1259 OID 42676)
-- Name: responses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.responses ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.responses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 219 (class 1259 OID 42553)
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    code public.role_code NOT NULL,
    name_th text NOT NULL
);


--
-- TOC entry 226 (class 1259 OID 42618)
-- Name: survey_time_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.survey_time_slots (
    survey_id bigint NOT NULL,
    slot_id bigint NOT NULL
);


--
-- TOC entry 223 (class 1259 OID 42586)
-- Name: surveys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.surveys (
    id bigint NOT NULL,
    year_be integer NOT NULL,
    title text NOT NULL,
    description text,
    is_active boolean DEFAULT false NOT NULL,
    starts_at date,
    ends_at date,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 222 (class 1259 OID 42585)
-- Name: surveys_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.surveys ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.surveys_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 225 (class 1259 OID 42605)
-- Name: time_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.time_slots (
    id bigint NOT NULL,
    name text NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    max_attempts integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_slot_attempts CHECK ((max_attempts >= 1)),
    CONSTRAINT chk_slot_time CHECK ((start_time < end_time))
);


--
-- TOC entry 224 (class 1259 OID 42604)
-- Name: time_slots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.time_slots ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.time_slots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 221 (class 1259 OID 42561)
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    role public.role_code NOT NULL,
    department_id bigint,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_login_at timestamp with time zone,
    title text,
    first_name text,
    last_name text,
    profile_image_url text,
    phone character varying(20),
    email character varying(150),
    approval_status text DEFAULT 'approved'::text NOT NULL,
    registration_source text DEFAULT 'admin'::text NOT NULL,
    approval_reviewed_by bigint,
    approval_reviewed_at timestamp with time zone,
    rejected_reason text,
    CONSTRAINT chk_users_approval_status CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))),
    CONSTRAINT chk_users_registration_source CHECK ((registration_source = ANY (ARRAY['admin'::text, 'self'::text])))
);


--
-- TOC entry 220 (class 1259 OID 42560)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.users ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 4912 (class 2606 OID 42718)
-- Name: answers answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_pkey PRIMARY KEY (id);


--
-- TOC entry 4933 (class 2606 OID 42982)
-- Name: department_central_question_settings department_central_question_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_central_question_settings
    ADD CONSTRAINT department_central_question_settings_pkey PRIMARY KEY (department_id, survey_id);


--
-- TOC entry 4930 (class 2606 OID 42963)
-- Name: department_central_questions department_central_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_central_questions
    ADD CONSTRAINT department_central_questions_pkey PRIMARY KEY (department_id, question_id);


--
-- TOC entry 4936 (class 2606 OID 43080)
-- Name: department_groups department_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_groups
    ADD CONSTRAINT department_groups_pkey PRIMARY KEY (id);


--
-- TOC entry 4871 (class 2606 OID 42551)
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- TOC entry 4928 (class 2606 OID 42944)
-- Name: password_reset_otps password_reset_otps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_otps
    ADD CONSTRAINT password_reset_otps_pkey PRIMARY KEY (id);


--
-- TOC entry 4918 (class 2606 OID 42743)
-- Name: qrcodes qrcodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qrcodes
    ADD CONSTRAINT qrcodes_pkey PRIMARY KEY (id);


--
-- TOC entry 4900 (class 2606 OID 42645)
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (id);


--
-- TOC entry 4922 (class 2606 OID 42759)
-- Name: rating_bands rating_bands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rating_bands
    ADD CONSTRAINT rating_bands_pkey PRIMARY KEY (id);


--
-- TOC entry 4902 (class 2606 OID 42673)
-- Name: respondent_tokens respondent_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respondent_tokens
    ADD CONSTRAINT respondent_tokens_pkey PRIMARY KEY (id);


--
-- TOC entry 4904 (class 2606 OID 42675)
-- Name: respondent_tokens respondent_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respondent_tokens
    ADD CONSTRAINT respondent_tokens_token_key UNIQUE (token);


--
-- TOC entry 4910 (class 2606 OID 42682)
-- Name: responses responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_pkey PRIMARY KEY (id);


--
-- TOC entry 4875 (class 2606 OID 42559)
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (code);


--
-- TOC entry 4894 (class 2606 OID 42622)
-- Name: survey_time_slots survey_time_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_time_slots
    ADD CONSTRAINT survey_time_slots_pkey PRIMARY KEY (survey_id, slot_id);


--
-- TOC entry 4888 (class 2606 OID 42595)
-- Name: surveys surveys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_pkey PRIMARY KEY (id);


--
-- TOC entry 4892 (class 2606 OID 42617)
-- Name: time_slots time_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_slots
    ADD CONSTRAINT time_slots_pkey PRIMARY KEY (id);


--
-- TOC entry 4916 (class 2606 OID 42720)
-- Name: answers uq_answer_once; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT uq_answer_once UNIQUE (response_id, question_id);


--
-- TOC entry 4924 (class 2606 OID 42761)
-- Name: rating_bands uq_band; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rating_bands
    ADD CONSTRAINT uq_band UNIQUE (min_value, max_value);


--
-- TOC entry 4890 (class 2606 OID 42597)
-- Name: surveys uq_surveys_year; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT uq_surveys_year UNIQUE (year_be);


--
-- TOC entry 4881 (class 2606 OID 42934)
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- TOC entry 4883 (class 2606 OID 42570)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4885 (class 2606 OID 42572)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 4913 (class 1259 OID 42731)
-- Name: idx_answers_question; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_answers_question ON public.answers USING btree (question_id);


--
-- TOC entry 4914 (class 1259 OID 42732)
-- Name: idx_answers_response; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_answers_response ON public.answers USING btree (response_id);


--
-- TOC entry 4934 (class 1259 OID 42993)
-- Name: idx_department_central_question_settings_survey; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_department_central_question_settings_survey ON public.department_central_question_settings USING btree (survey_id);


--
-- TOC entry 4931 (class 1259 OID 42974)
-- Name: idx_department_central_questions_question; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_department_central_questions_question ON public.department_central_questions USING btree (question_id);


--
-- TOC entry 4872 (class 1259 OID 42552)
-- Name: idx_departments_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_active ON public.departments USING btree (is_active);


--
-- TOC entry 4873 (class 1259 OID 43087)
-- Name: idx_departments_department_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_department_group ON public.departments USING btree (department_group_id);


--
-- TOC entry 4925 (class 1259 OID 42950)
-- Name: idx_password_reset_otps_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_otps_email ON public.password_reset_otps USING btree (email);


--
-- TOC entry 4926 (class 1259 OID 42951)
-- Name: idx_password_reset_otps_reset_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_otps_reset_token_hash ON public.password_reset_otps USING btree (reset_token_hash);


--
-- TOC entry 4895 (class 1259 OID 42663)
-- Name: idx_questions_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_dept ON public.questions USING btree (department_id);


--
-- TOC entry 4896 (class 1259 OID 42664)
-- Name: idx_questions_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_order ON public.questions USING btree (survey_id, display_order);


--
-- TOC entry 4897 (class 1259 OID 42662)
-- Name: idx_questions_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_scope ON public.questions USING btree (scope);


--
-- TOC entry 4898 (class 1259 OID 42661)
-- Name: idx_questions_survey; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_questions_survey ON public.questions USING btree (survey_id);


--
-- TOC entry 4905 (class 1259 OID 42706)
-- Name: idx_responses_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_responses_date ON public.responses USING btree (responded_date);


--
-- TOC entry 4906 (class 1259 OID 42707)
-- Name: idx_responses_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_responses_group ON public.responses USING btree (respondent_group);


--
-- TOC entry 4907 (class 1259 OID 42708)
-- Name: idx_responses_slot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_responses_slot ON public.responses USING btree (slot_id);


--
-- TOC entry 4908 (class 1259 OID 42705)
-- Name: idx_responses_survey_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_responses_survey_dept ON public.responses USING btree (survey_id, department_id);


--
-- TOC entry 4886 (class 1259 OID 42603)
-- Name: idx_surveys_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_surveys_active ON public.surveys USING btree (is_active);


--
-- TOC entry 4876 (class 1259 OID 42956)
-- Name: idx_users_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_approval_status ON public.users USING btree (approval_status);


--
-- TOC entry 4877 (class 1259 OID 42584)
-- Name: idx_users_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_department ON public.users USING btree (department_id);


--
-- TOC entry 4878 (class 1259 OID 42957)
-- Name: idx_users_registration_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_registration_source ON public.users USING btree (registration_source);


--
-- TOC entry 4879 (class 1259 OID 42583)
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- TOC entry 4937 (class 1259 OID 43081)
-- Name: uq_department_groups_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_department_groups_name ON public.department_groups USING btree (lower(TRIM(BOTH FROM name)));


--
-- TOC entry 4919 (class 1259 OID 42750)
-- Name: uq_qrcode_central; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_qrcode_central ON public.qrcodes USING btree (type) WHERE (type = 'central'::public.qrcode_type);


--
-- TOC entry 4920 (class 1259 OID 42749)
-- Name: uq_qrcode_department; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_qrcode_department ON public.qrcodes USING btree (department_id) WHERE (type = 'department'::public.qrcode_type);


--
-- TOC entry 4951 (class 2606 OID 42726)
-- Name: answers answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id);


--
-- TOC entry 4952 (class 2606 OID 42721)
-- Name: answers answers_response_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_response_id_fkey FOREIGN KEY (response_id) REFERENCES public.responses(id) ON DELETE CASCADE;


--
-- TOC entry 4957 (class 2606 OID 42983)
-- Name: department_central_question_settings department_central_question_settings_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_central_question_settings
    ADD CONSTRAINT department_central_question_settings_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- TOC entry 4958 (class 2606 OID 42988)
-- Name: department_central_question_settings department_central_question_settings_survey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_central_question_settings
    ADD CONSTRAINT department_central_question_settings_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- TOC entry 4955 (class 2606 OID 42964)
-- Name: department_central_questions department_central_questions_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_central_questions
    ADD CONSTRAINT department_central_questions_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- TOC entry 4956 (class 2606 OID 42969)
-- Name: department_central_questions department_central_questions_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_central_questions
    ADD CONSTRAINT department_central_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;


--
-- TOC entry 4938 (class 2606 OID 43082)
-- Name: departments departments_department_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_department_group_id_fkey FOREIGN KEY (department_group_id) REFERENCES public.department_groups(id) ON DELETE RESTRICT;


--
-- TOC entry 4954 (class 2606 OID 42945)
-- Name: password_reset_otps password_reset_otps_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_otps
    ADD CONSTRAINT password_reset_otps_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4953 (class 2606 OID 42744)
-- Name: qrcodes qrcodes_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qrcodes
    ADD CONSTRAINT qrcodes_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- TOC entry 4944 (class 2606 OID 42656)
-- Name: questions questions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 4945 (class 2606 OID 42651)
-- Name: questions questions_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- TOC entry 4946 (class 2606 OID 42646)
-- Name: questions questions_survey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- TOC entry 4947 (class 2606 OID 42690)
-- Name: responses responses_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- TOC entry 4948 (class 2606 OID 42700)
-- Name: responses responses_respondent_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_respondent_token_id_fkey FOREIGN KEY (respondent_token_id) REFERENCES public.respondent_tokens(id);


--
-- TOC entry 4949 (class 2606 OID 42695)
-- Name: responses responses_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.time_slots(id);


--
-- TOC entry 4950 (class 2606 OID 42685)
-- Name: responses responses_survey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responses
    ADD CONSTRAINT responses_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id);


--
-- TOC entry 4942 (class 2606 OID 42628)
-- Name: survey_time_slots survey_time_slots_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_time_slots
    ADD CONSTRAINT survey_time_slots_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.time_slots(id);


--
-- TOC entry 4943 (class 2606 OID 42623)
-- Name: survey_time_slots survey_time_slots_survey_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_time_slots
    ADD CONSTRAINT survey_time_slots_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;


--
-- TOC entry 4941 (class 2606 OID 42598)
-- Name: surveys surveys_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.surveys
    ADD CONSTRAINT surveys_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 4939 (class 2606 OID 42578)
-- Name: users users_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- TOC entry 4940 (class 2606 OID 42573)
-- Name: users users_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_fkey FOREIGN KEY (role) REFERENCES public.roles(code);


-- Completed on 2026-07-18 15:26:02

--
-- PostgreSQL database dump complete
--

\unrestrict N9WiTRCRmzsvPigZzBtEzeU1k0XctIGPpkKa8TTWavsJnNhhrOkero62b7mU3va

