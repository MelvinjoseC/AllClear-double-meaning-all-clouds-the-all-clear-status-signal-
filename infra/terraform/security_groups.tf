# --- Load Balancer Security Group ---
resource "aws_security_group" "alb" {
  name        = "cloudmon-alb-sg-${var.environment}"
  description = "Controls access to the Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS access"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP redirect access"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "cloudmon-alb-sg-${var.environment}"
  }
}

# --- ECS Tasks Security Group ---
resource "aws_security_group" "ecs_tasks" {
  name        = "cloudmon-ecs-tasks-sg-${var.environment}"
  description = "Controls access to ECS tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Access from ALB only"
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "cloudmon-ecs-tasks-sg-${var.environment}"
  }
}

# --- Database Security Group ---
resource "aws_security_group" "db" {
  name        = "cloudmon-db-sg-${var.environment}"
  description = "Allows ECS tasks to connect to RDS"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from ECS tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "cloudmon-db-sg-${var.environment}"
  }
}
