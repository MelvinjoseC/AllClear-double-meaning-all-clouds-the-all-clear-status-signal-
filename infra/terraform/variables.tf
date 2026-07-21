variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (e.g. dev, prod)"
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "database_name" {
  description = "The name of the database to create"
  type        = string
  default     = "cloudmon"
}

variable "database_username" {
  description = "Username for the RDS database"
  type        = string
  default     = "cloudmon_admin"
}

variable "database_password" {
  description = "Password for the RDS database (should be overridden in production)"
  type        = string
  sensitive   = true
  default     = "cloudmon_db_pass_secure_123"
}

variable "jwt_secret" {
  description = "Secret key for signing JWT tokens"
  type        = string
  sensitive   = true
  default     = "cloudmon_jwt_secret_key_prod_override"
}
