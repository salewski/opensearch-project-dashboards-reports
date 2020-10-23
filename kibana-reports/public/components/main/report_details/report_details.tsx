/*
 * Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

import React, { useEffect, useState } from 'react';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiPage,
  EuiPageHeader,
  EuiTitle,
  EuiPageBody,
  EuiPageContent,
  EuiHorizontalRule,
  EuiSpacer,
  EuiDescriptionList,
  EuiDescriptionListTitle,
  EuiDescriptionListDescription,
  EuiPageHeaderSection,
  EuiButton,
  EuiLink,
  EuiIcon,
  EuiGlobalToastList,
} from '@elastic/eui';
import { fileFormatsUpper, generateReportById } from '../main_utils';
import { ReportSchemaType } from '../../../../server/model';
import { converter } from '../../report_definitions/utils';
import dateMath from '@elastic/datemath';

export const ReportDetailsComponent = (props) => {
  const { reportDetailsComponentTitle, reportDetailsComponentContent } = props;

  return (
    <EuiFlexItem>
      <EuiDescriptionList>
        <EuiDescriptionListTitle>
          {reportDetailsComponentTitle}
        </EuiDescriptionListTitle>
        <EuiDescriptionListDescription>
          {reportDetailsComponentContent}
        </EuiDescriptionListDescription>
      </EuiDescriptionList>
    </EuiFlexItem>
  );
};

// convert markdown to plain text, trim it if it's longer than 3 lines
export const trimAndRenderAsText = (markdown: string) => {
  if (!markdown) return markdown;
  const lines = markdown.split('\n').filter((line) => line);
  const elements = lines.slice(0, 3).map((line, i) => <p key={i}>{line}</p>);
  return lines.length <= 3 ? elements : elements.concat(<p key={3}>...</p>);
};

export const formatEmails = (emails: string[]) => {
  return Array.isArray(emails) ? emails.join(', ') : emails;
};

export function ReportDetails(props) {
  const [reportDetails, setReportDetails] = useState({});
  const [toasts, setToasts] = useState([]);

  const reportId = props.match['params']['reportId'];

  const addErrorToastHandler = () => {
    const errorToast = {
      title: 'Error loading report details',
      color: 'danger',
      iconType: 'alert',
      id: 'reportDetailsErrorToast',
    };
    setToasts(toasts.concat(errorToast));
  };

  const handleErrorToast = () => {
    addErrorToastHandler();
  };

  const addSuccessToastHandler = () => {
    const successToast = {
      title: 'Success',
      color: 'success',
      text: <p>Report successfully downloaded!</p>,
      id: 'onDemandDownloadSuccessToast',
    };
    setToasts(toasts.concat(successToast));
  };

  const handleSuccessToast = () => {
    addSuccessToastHandler();
  };

  const removeToast = (removedToast) => {
    setToasts(toasts.filter((toast) => toast.id !== removedToast.id));
  };

  const handleReportDetails = (e) => {
    setReportDetails(e);
  };

  const convertTimestamp = (timestamp: number) => {
    let displayDate = `\u2014`;
    if (timestamp) {
      let readableDate = new Date(timestamp);
      displayDate = readableDate.toLocaleString();
    }
    return displayDate;
  };

  const parseTimePeriod = (queryUrl: string) => {
    let timeString = queryUrl.substring(
      queryUrl.lastIndexOf('time:'),
      queryUrl.lastIndexOf('))')
    );

    let fromDateString = timeString.substring(
      timeString.lastIndexOf('from:') + 5,
      timeString.lastIndexOf(',')
    );

    let toDateString = timeString.substring(
      timeString.lastIndexOf('to:') + 3,
      timeString.length
    );
    fromDateString = fromDateString.replace(/[']+/g, '');
    toDateString = toDateString.replace(/[']+/g, '');

    let fromDateParsed = dateMath.parse(fromDateString);
    let toDateParsed = dateMath.parse(toDateString);

    const fromTimePeriod = fromDateParsed?.toDate();
    const toTimePeriod = toDateParsed?.toDate();
    return (
      fromTimePeriod?.toLocaleString() + ' -> ' + toTimePeriod?.toLocaleString()
    );
  };

  const getReportDetailsData = (report: ReportSchemaType) => {
    const {
      report_definition: reportDefinition,
      last_updated: lastUpdated,
      state,
      query_url: queryUrl,
    } = report;
    const { report_params: reportParams, trigger, delivery } = reportDefinition;
    const {
      trigger_type: triggerType,
      trigger_params: triggerParams,
    } = trigger;
    const {
      delivery_type: deliveryType,
      delivery_params: deliveryParams,
    } = delivery;
    const coreParams = reportParams.core_params;
    // covert timestamp to local date-time string
    let reportDetails = {
      reportName: reportParams.report_name,
      description:
        reportParams.description === '' ? `\u2014` : reportParams.description,
      created: convertTimestamp(report.time_created),
      lastUpdated: convertTimestamp(report.last_updated),
      source: reportParams.report_source,
      // TODO:  we have all data needed, time_from, time_to, time_duration,
      // think of a way to better display
      time_period: parseTimePeriod(queryUrl),
      defaultFileFormat: coreParams.report_format,
      state: state,
      reportHeader: reportParams.core_params.hasOwnProperty('header')
        ? converter.makeMarkdown(reportParams.core_params.header)
        : `\u2014`,
      reportFooter: reportParams.core_params.hasOwnProperty('footer')
        ? converter.makeMarkdown(reportParams.core_params.footer)
        : `\u2014`,
      triggerType: triggerType,
      scheduleType: triggerParams ? triggerParams.schedule_type : `\u2014`,
      scheduleDetails: `\u2014`,
      alertDetails: `\u2014`,
      channel: deliveryType,
      emailRecipients:
        deliveryType === 'Channel' ? deliveryParams.recipients : `\u2014`,
      emailSubject:
        deliveryType === 'Channel' ? deliveryParams.title : `\u2014`,
      emailBody:
        deliveryType === 'Channel' ? deliveryParams.textDescription : `\u2014`,
      queryUrl: queryUrl,
    };
    return reportDetails;
  };

  useEffect(() => {
    const { httpClient } = props;
    httpClient
      .get('../api/reporting/reports/' + reportId)
      .then((response) => {
        handleReportDetails(getReportDetailsData(response));
        props.setBreadcrumbs([
          {
            text: 'Reporting',
            href: '#',
          },
          {
            text:
              'Report details: ' +
              response.report_definition.report_params.report_name,
          },
        ]);
      })
      .catch((error) => {
        console.log('Error when fetching report details: ', error);
        handleErrorToast();
      });
  }, []);

  const fileFormatDownload = (data) => {
    let formatUpper = data['defaultFileFormat'];
    formatUpper = fileFormatsUpper[formatUpper];
    return (
      <EuiLink
        onClick={() => {
          generateReportById(
            reportId,
            props.httpClient,
            handleSuccessToast,
            handleErrorToast
          );
        }}
      >
        {formatUpper + ' '}
        <EuiIcon type="importAction" />
      </EuiLink>
    );
  };

  const sourceURL = (data) => {
    return (
      <EuiLink href={`${location.host}${data.queryUrl}`} target="_blank">
        {data['source']}
      </EuiLink>
    );
  };

  return (
    <EuiPage>
      <EuiPageBody>
        <EuiTitle size="l">
          <h1>Report details</h1>
        </EuiTitle>
        <EuiSpacer size="m" />
        <EuiPageContent panelPaddingSize={'l'}>
          <EuiPageHeader>
            <EuiFlexGroup>
              <EuiFlexItem>
                <EuiPageHeaderSection>
                  <EuiTitle>
                    <h2>{reportDetails['reportName']}</h2>
                  </EuiTitle>
                </EuiPageHeaderSection>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiPageHeader>
          <EuiHorizontalRule />
          <EuiTitle>
            <h3>Report Settings</h3>
          </EuiTitle>
          <EuiSpacer />
          <EuiFlexGroup>
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Name'}
              reportDetailsComponentContent={reportDetails['reportName']}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Description'}
              reportDetailsComponentContent={reportDetails['description']}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Created'}
              reportDetailsComponentContent={reportDetails['created']}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Last updated'}
              reportDetailsComponentContent={reportDetails['lastUpdated']}
            />
          </EuiFlexGroup>
          <EuiSpacer />
          <EuiFlexGroup>
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Source'}
              reportDetailsComponentContent={sourceURL(reportDetails)}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Time period'}
              reportDetailsComponentContent={reportDetails.time_period}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'File format'}
              reportDetailsComponentContent={fileFormatDownload(reportDetails)}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'State'}
              reportDetailsComponentContent={reportDetails['state']}
            />
          </EuiFlexGroup>
          <EuiSpacer />
          <EuiFlexGroup>
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Report header'}
              reportDetailsComponentContent={trimAndRenderAsText(
                reportDetails['reportHeader']
              )}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Report footer'}
              reportDetailsComponentContent={trimAndRenderAsText(
                reportDetails['reportFooter']
              )}
            />
            <ReportDetailsComponent />
            <ReportDetailsComponent />
          </EuiFlexGroup>
          <EuiSpacer />
          <EuiTitle>
            <h3>Report trigger</h3>
          </EuiTitle>
          <EuiSpacer />
          <EuiFlexGroup>
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Report type'}
              reportDetailsComponentContent={reportDetails['triggerType']}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Schedule type'}
              reportDetailsComponentContent={reportDetails['scheduleType']}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Schedule details'}
              reportDetailsComponentContent={reportDetails['scheduleDetails']}
            />
            <ReportDetailsComponent />
          </EuiFlexGroup>
          <EuiSpacer />
          <EuiTitle>
            <h3>Notification settings</h3>
          </EuiTitle>
          <EuiSpacer />
          <EuiFlexGroup>
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Email recipient(s)'}
              reportDetailsComponentContent={formatEmails(
                reportDetails['emailRecipients']
              )}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Email subject'}
              reportDetailsComponentContent={reportDetails['emailSubject']}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Optional message'}
              reportDetailsComponentContent={trimAndRenderAsText(
                reportDetails['emailBody']
              )}
            />
            <ReportDetailsComponent />
          </EuiFlexGroup>
        </EuiPageContent>
        <EuiGlobalToastList
          toasts={toasts}
          dismissToast={removeToast}
          toastLifeTimeMs={6000}
        />
      </EuiPageBody>
    </EuiPage>
  );
}
