# --- RDS Subnet Group ---
resource "aws_db_subnet_group" "main" {
  name        = "cloudmon-db-subnet-group-${var.environment}"
  description = "Subnet group for RDS PostgreSQL"
  subnet_ids  = aws_subnet.private[*].id

  tags = {
    Name = "cloudmon-db-subnet-group-${var.environment}"
  }
}

# --- RDS Instance ---
resource "aws_db_instance" "postgres" {
  identifier             = "cloudmon-db-${var.environment}"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = "db.t4g.micro"
  allocated_storage      = 20
  max_allocated_storage  = 100
  storage_type           = "gp3"
  db_name                = var.database_name
  username               = var.database_username
  password               = var.database_password
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  skip_final_snapshot    = true

  tags = {
    Name = "cloudmon-postgres-${var.environment}"
  }
}
