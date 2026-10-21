CREATE TABLE `expo_show` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `show001` varchar(20) NOT NULL DEFAULT '' COMMENT '展会编号',
  `show002` varchar(200) DEFAULT NULL COMMENT '展会名称',
  `show008` varchar(50) DEFAULT NULL COMMENT '展馆1名称',
  `start_date` date DEFAULT '0000-00-00',
  `budget` varchar(32) DEFAULT NULL COMMENT '预算（老系统存成带逗号字符串）',
  `is_open` tinyint(1) NOT NULL DEFAULT '0',
  `show_type` enum('1','2','3') DEFAULT '1',
  `remark` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_show` (`show001`),
  KEY `idx_name` (`show002`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COMMENT='展会届次主表';
